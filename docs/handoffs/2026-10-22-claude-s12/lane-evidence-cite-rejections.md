# Evidence-cite lane: rejected and unselected Vitest/Playwright candidates

Generated 2026-10-22 by lane `claude_s12_evidence_cite`. Source: the intake classification (`.lane-logs/s12-claude-intake-20261022/classify-*.json`), every vitest/playwright candidate of an uncited clause. A candidate is **rejected** when its assertion was read and does not prove the clause (neighbour, relay of a stubbed port for a decision clause, shape-only, wrong layer, unusable identity) and **not selected** when it was left out as redundant or analogous (31 rows, no individual verdict). Candidates that were cited or held are in the report table and in `lane-evidence-cite-held.json`. Reasons repeat when one verdict covers a whole criterion.

Counts: 430 rejected, 31 not selected.

## P2-S12-AC-005

- clause 1 [medium] `tests/postgrest/phase-02-slice-12-template-version.apispec.ts` :: CMS-03C-01 define a template version through the real stack [P2-S12-AC-005] an unknown member and a body that is not JSON are refused before any write
  - not selected: no individual verdict recorded: redundant to the cited tests of the same clause, a neighbour/analogue of the clause, or its criterion was left uncited as monolithic (see the criterion limitation)

## P2-S12-AC-010

- clause 1 [high] `apps/worker/src/cms-composition/pattern-placement-http.test.ts` :: CMS-03C-02 pattern placement at the HTTP app.request boundary [P2-S12-AC-010] answers 201 with the placement list and the forwarded entry ETag
  - not selected: no individual verdict recorded: redundant to the cited tests of the same clause, a neighbour/analogue of the clause, or its criterion was left uncited as monolithic (see the criterion limitation)
- clause 1 [high] `apps/worker/src/cms-composition/pattern-placement.test.ts` :: CMS-03C-02 pattern placement at the production adapter boundary [P2-S12-AC-010] fails closed on a legacy single-resource placement body
  - not selected: no individual verdict recorded: redundant to the cited tests of the same clause, a neighbour/analogue of the clause, or its criterion was left uncited as monolithic (see the criterion limitation)
- clause 2 [medium] `apps/worker/src/cms-composition-production-pattern-composed.test.ts` :: CMS-03C-02 fetch double to production adapter to route publishes revision_not_editable as 409 COMPOSITION_VERSION_CONFLICT with exactly its reasonCode (FE03 1112)
  - not selected: no individual verdict recorded: redundant to the cited tests of the same clause, a neighbour/analogue of the clause, or its criterion was left uncited as monolithic (see the criterion limitation)
- clause 2 [high] `apps/web/src/server/cms-composition-platform-pattern-placement.test.ts` :: CMS-03C-02 web proxy: request binding and transport [P2-S12-AC-010] forwards the validated placement body and allowlisted headers once
  - not selected: no individual verdict recorded: redundant to the cited tests of the same clause, a neighbour/analogue of the clause, or its criterion was left uncited as monolithic (see the criterion limitation)

## P2-S12-AC-011

- clause 2 [high] `apps/worker/src/cms-composition/pattern-instance-reasons.test.ts` :: CMS-03C-02 route typed Slice 12 refusals relays the depth/nodes 422 violations and nothing else
  - rejected: Worker relay of a port-supplied violation, not the exact violation of an invalid request value

## P2-S12-AC-012

- clause 2 [high] `apps/worker/src/cms-composition/pattern-instance-reasons.test.ts` :: CMS-03C-02 route typed Slice 12 refusals answers its own capability refusal with the 03c token capability_missing (BE03c 1304), not CAPABILITY_REQUIRED
  - rejected: Worker 403 capability_missing proves the capability gate, not the locked scope (assigned author or editor on the current draft revision), which only the RPC decides (pgTAP)
- clause 5 [medium] `apps/worker/src/cms-composition-production-pattern.test.ts` :: CMS-03C-02 production pattern adapter maps private domain failures and transport failures without exposing provider content
  - rejected: production adapter maps a stubbed private 404 to COMPOSITION_NOT_FOUND; it relays a status and does not prove that a hidden target is concealed as 404 (consistent with AC-006 limitation)

## P2-S12-AC-013

- clause 0 [medium] `packages/contracts/src/cms-composition/pattern-instance.test.ts` :: CMS-03C-02 pattern-instance wire contract requires canonical JSON, idempotency, and a strong successor validator
  - rejected: header shape (canonical JSON, idempotency key present) only; enforcement of replay and changed-body 409 is database behaviour (pgTAP), so a header test is not proof of 'enforce declared idempotency'
- clause 1 [medium] `apps/worker/src/cms-composition/pattern-instance-reasons.test.ts` :: CMS-03C-02 route typed Slice 12 refusals keeps the untyped stale-CAS 409 as its version pair
  - rejected: Worker relay of a stubbed 409 version pair; the CAS itself is the RPC (pgTAP)

## P2-S12-AC-014

- clause 1 [medium] `apps/worker/src/cms-composition/pattern-instance-boundary.test.ts` :: CMS-03C-02 Worker failure and availability boundaries fails closed on session absence, malformed envelope, or missing capability
  - rejected: session absence/malformed envelope/missing capability fail-closed statuses; proves 401/403/502 mapping, not the declared dependency failure mapping to DEPENDENCY_UNAVAILABLE

## P2-S12-AC-016

- clause 1 [high] `apps/worker/src/cms-composition-production-taxonomy-act.test.ts` :: CMS-03C-03 production port: the named RPC (BE03c 1447, 1506) answers 200 with the strict term and a quoted ETag of the term version
  - rejected: production port with a fetch double: adapter plus route, not a composed served path; ledger rule (AC-004) treats separately proven layers as not proving the happy path
- clause 1 [high] `apps/worker/src/cms-composition/taxonomy-routes.test.ts` :: CMS-03C-03 taxonomy term actions route serves a validated term from the protected port with both rate buckets
  - rejected: Worker route with a stubbed port returning the 200 resource

## P2-S12-AC-017

- clause 2 [high] `apps/worker/src/cms-composition/taxonomy-term-details.test.ts` :: CMS-03C-03 typed refusals on the wire keeps the plain 409 versions and 422 pointers alongside the typed reasons
  - rejected: Worker relay of a port-supplied 422 pointer, not the exact violation for an invalid request value

## P2-S12-AC-018

- clause 2 [high] `apps/worker/src/cms-composition/taxonomy-term-details.test.ts` :: CMS-03C-03 typed refusals on the wire the Worker capability gate publishes the contract token capability_missing
  - rejected: Worker capability gate (cms.editor lacks the curator capability, 403 capability_missing) proves the capability check, not the per-vocabulary scope the RPC decides (pgTAP)

## P2-S12-AC-019

- clause 3 [high] `apps/worker/src/cms-composition-production-taxonomy-act.test.ts` :: CMS-03C-03 production port: the named RPC (BE03c 1447, 1506) replays the identical bytes and key on a repeated request (no retry, no regeneration)
  - rejected: production port re-sends identical bytes and key on a repeated call; that is client-side key reuse, not the server replay behaviour (stored response, no second row) which is RPC/pgTAP

## P2-S12-AC-021

- clause 1 [medium] `apps/worker/src/cms-composition-production-taxonomy-act.test.ts` :: CMS-03C-03 production port: the named RPC (BE03c 1447, 1506) replays the identical bytes and key on a repeated request (no retry, no regeneration)
  - rejected: client-side idempotency key reuse by the production port, not lost-response reconciliation without duplicate effects (RPC replay, pgTAP)

## P2-S12-AC-023

- clause 1 [medium] `tests/postgrest/phase-02-slice-12-template-version.apispec.ts` :: CMS-03C-01 define a template version through the real stack [P2-S12-AC-005] a value the contract accepts and the database refuses (a compatible type that is not the caller's active type, a reserved concept key) is a 422 …
  - rejected: real-stack case refuses a type that is not the caller's active type (another owner); it does not supply a type that exists and is owned but inactive, nor an allowlist rule, so it proves a neighbour of 'each active/allowlisted family'

## P2-S12-AC-026

- clause 1 [medium] `apps/worker/src/cms-composition/pattern-instance-reasons.test.ts` :: CMS-03C-02 route typed Slice 12 refusals publishes revision_not_editable as 409 COMPOSITION_VERSION_CONFLICT with exactly its reasonCode
  - rejected: Worker relay of a stubbed typed 409 revision_not_editable; the enforcement of the current-draft rule is the RPC (pgTAP)
- clause 3 [medium] `apps/worker/src/cms-composition/pattern-instance-routes.test.ts` :: CMS-03C-02 protected pattern instance route rejects malformed, cross-origin, and missing-authority requests before mutation
  - rejected: route rejects malformed, cross-origin and missing-authority requests (400/403/415/422); no 404 is asserted, so it does not prove '400/404'

## P2-S12-AC-028

- clause 1 [high] `packages/contracts/src/cms-composition/pattern-instance.test.ts` :: CMS-03C-02 pattern-instance wire contract [P2-S12-AC-028] bounds the slot path at 1 to 512 characters with no control character
  - rejected: slot path bounds only; cited nowhere new because clause 2 (path 1-512 chars) is already cited
- clause 6 [high] `packages/contracts/src/cms-composition/dec193-contract-migration.test.ts` :: DEC-193 public address, stored caps and pattern roots [DEC-193][roots-1] accepts an omitted roots member and a 1-512 unique full-address list
  - rejected: contract accepts/refuses the roots list shape only; the clause is the server rule (each a block root of the pinned forest, 422 at /roots/{n}, only named roots placed, overrides under no root 422 at /overrides) which is RPC/pgTAP
- clause 6 [high] `apps/worker/src/cms-composition/pattern-placement-http.test.ts` :: CMS-03C-02 selected-root response binding (DEC-193) [P2-S12-AC-218] forwards the selected set without reordering sparse successor rows
  - rejected: Worker forwards a stubbed selected set; does not prove the roots rule

## P2-S12-AC-029

- clause 0 [high] `apps/worker/src/cms-composition/pattern-instance-reasons.test.ts` :: CMS-03C-02 route typed Slice 12 refusals publishes pattern_cycle as 409 COMPOSITION_VERSION_CONFLICT with exactly its reasonCode
  - rejected: Worker relay of a stubbed typed pattern_cycle 409; the graph rules are RPC behaviour (pgTAP)

## P2-S12-AC-030

- clause 1 [high] `apps/worker/src/cms-composition-production-taxonomy-act-tokens.test.ts` :: CMS-03C-03 production port: token mapping (BE03c 1290, 1298-1306, 1375) taxonomy_not_active
  - rejected: production port maps the taxonomy_not_active token; adapter token mapping, not the RPC rule that refuses a vocabulary without an active TaxonomyVersion

## P2-S12-AC-036

- clause 1 [high] `apps/web/src/components/cms-related-content/CmsRelatedContentForm.lists.test.tsx` :: CmsRelatedContentForm: exclusions win excludes an entry and removes its pin, saying so
  - rejected: form drops a pin when its entry is excluded (a UI convenience announcing exclusions win), not the write rule or the public projection
- clause 3 [high] `apps/worker/src/cms-composition/related-content-typed-refusals.test.ts` :: CMS-03C-05 typed refusals (BE03c 1304, 1380-1383) publishes related_target_ineligible with the offending row pointers as one uniform 422
  - rejected: Worker relay of a stubbed uniform 422; the eligibility determination is the RPC (pgTAP)
- clause 3 [high] `apps/worker/src/cms-composition-production-related.test.ts` :: CMS-03C-05 production related-content adapter maps the typed uniform refusal to a 422 with the offending row pointers
  - rejected: adapter mapping of a stubbed RPC raise; relay, not the determination
- clause 3 [medium] `apps/web/src/components/cms-related-content/CmsRelatedContentForm.refusals.test.tsx` :: an ineligible target (422 related_target_ineligible) never explains the cause: no mention of inactive, hidden, owner, readable, absent or self
  - rejected: form copy for the 422, not the uniform determination

## P2-S12-AC-037

- clause 3 [high] `apps/worker/src/cms-composition/related-content-typed-refusals.test.ts` :: CMS-03C-05 typed refusals (BE03c 1304, 1380-1383) publishes derived_rule_unknown at its member pointer
  - rejected: Worker relay of a stubbed derived_rule_unknown 422 pointer; the clause for the 422 is bound to the key/version determination in the RPC
- clause 3 [high] `apps/worker/src/cms-composition-production-related.test.ts` :: CMS-03C-05 production related-content adapter maps derived_rule_unknown, capability_missing and the schema failure
  - rejected: adapter mapping of a stubbed raise

## P2-S12-AC-038

- clause 1 [high] `apps/worker/src/cms-composition/related-content-admission.test.ts` :: BE00 steps 2 and 8 on the CMS related-content route refuses a body expectedVersion that differs from If-Match once headers are checked
  - rejected: asserts the 400 If-Match/expectedVersion mismatch only; the clause is 400/409 and the stale-409 is the RPC
- clause 1 [high] `packages/contracts/src/cms-composition/related-content.test.ts` :: CMS-03C-05 If-Match operand [P2-S12-AC-061] ties the strong If-Match to the source entry version expectedVersion, reported at headers.ifMatch
  - rejected: asserts the 400 mismatch only (header tie); no 409
- clause 2 [high] `packages/contracts/src/cms-composition/related-public-target.test.ts` :: CMS-03C-21 related public targets (D11, OD-5) [P2-S12-AC-154] returns at most 128 targets, pins first in position order and then derived candidates in rank order
  - rejected: contract bounds/order of the projection shape; the projection derivation is SQL (pgTAP)
- clause 2 [medium] `apps/worker/src/cms-composition/related-content-no-public-targets-route.test.ts` :: CMS-03C-21 has no browser route (BE03c 190) answers 404 or 405 for GET /api/v1/cms/entries/10000000-0000-4000-8000-000000000001/related-content/public-targets
  - rejected: asserts no browser route exists; neither proves the owned projection

## P2-S12-AC-040

- clause 3 [high] `apps/worker/src/cms-governed-activation-sweep.test.ts` :: executing claims executes each claim in order with the review version and the lease, calling nothing else
  - rejected: one executor sweep case; the clause is a meta obligation over seven operations, discharged only by the per-operation clauses, not by one representative

## P2-S12-AC-042

- clause 1 [low] `apps/web/src/components/cms-composition/CmsTemplateEditDesigner.uncertain-pending.test.tsx` :: CMS-11 uncertain attempt admission and pending controls B-TPL-001 disables only commit while a POST is held and preserves later editing
  - rejected: disables commit while a POST is held; does not assert focus staying until navigation or a named result heading
- clause 5 [medium] `apps/web/src/components/cms-composition/cms-template-designer-submit.test.ts` :: CMS-11 first-party draft submission posts a validated create with CSRF and stable idempotency, then accepts only an authoritative resource
  - rejected: submit client accepts only an authoritative resource; no provenance or next action is rendered or asserted
- clause 5 [low] `apps/web/src/components/cms-composition/cms-template-designer-submit.test.ts` :: CMS-11 first-party draft submission posts a successor with exact strong If-Match and accepts only a newer authoritative draft
  - rejected: successor submit client; same, no rendered provenance
- clause 12 [low] `apps/web/src/components/cms-composition/CmsTemplateDesigner.interaction.test.tsx` :: CMS-11 template designer interaction keeps the draft values and idempotency key across an uncertain retry
  - rejected: keeps unsent values and the idempotency key across a retry; no scoped draft store written before commit
- clause 12 [low] `apps/web/src/components/cms-composition/CmsTemplateEditDesigner.interaction.test.tsx` :: CMS-11 successor edit and reconciliation keeps unsent values through conflict and requires an explicit latest-version rebase
  - rejected: keeps unsent values through a conflict; same, not a scoped draft store

## P2-S12-AC-043

- clause 4 [high] `apps/worker/src/cms-composition/pattern-definition-write.test.ts` :: CMS-03C-12 pattern definition write contract rejects a successor answer that is not parent plus one
  - rejected: meta obligation over four operations (and the edit-authority/readability/tree-limit clauses are RPC/pgTAP): one representative route/contract test cannot prove completion of every operation
- clause 4 [high] `apps/worker/src/cms-composition/pattern-selector-routes.test.ts` :: CMS-03C-13 selector route serves the strict page with the quoted page-version ETag
  - rejected: meta obligation over four operations (and the edit-authority/readability/tree-limit clauses are RPC/pgTAP): one representative route/contract test cannot prove completion of every operation
- clause 4 [high] `apps/worker/src/cms-composition/pattern-update-diff-routes.test.ts` :: CMS-03C-14 update-diff route serves the strict diff with the quoted instance-version ETag
  - rejected: meta obligation over four operations (and the edit-authority/readability/tree-limit clauses are RPC/pgTAP): one representative route/contract test cannot prove completion of every operation
- clause 4 [high] `apps/worker/src/cms-composition/pattern-update-routes.test.ts` :: CMS-03C-15 pattern-update route accepts: 200 { items } with the committed entry ETag and the exact precondition at the port
  - rejected: meta obligation over four operations (and the edit-authority/readability/tree-limit clauses are RPC/pgTAP): one representative route/contract test cannot prove completion of every operation
- clause 4 [high] `tests/contracts/phase-02-slice-12-pattern-openapi.test.ts` :: Slice 12 pattern registry rows and generated OpenAPI (CMS-03C-12 to CMS-03C-15) [P2-S12-AC-106] keeps the fixed pattern routes distinct from the latest-read path
  - rejected: meta obligation over four operations (and the edit-authority/readability/tree-limit clauses are RPC/pgTAP): one representative route/contract test cannot prove completion of every operation

## P2-S12-AC-045

- clause 0 [medium] `apps/web/src/components/cms-pattern-designer/CmsPatternVersionDesigner.uncertain-reconcile.test.tsx` :: CmsPatternVersionDesigner: an unknown outcome stays pending until the reconcile read settles sends no second command when the form is submitted again while the read is held
  - rejected: pattern version designer tests; the clause is the 'use pattern' surface (placement form, selector, update-diff), which has no component or Playwright spec
- clause 0 [medium] `apps/web/src/components/cms-pattern-designer/CmsPatternVersionDesigner.results.test.tsx` :: CmsPatternVersionDesigner: what the server answered says a typed refusal in fixed words and keeps the tree
  - rejected: pattern version designer tests; the clause is the 'use pattern' surface (placement form, selector, update-diff), which has no component or Playwright spec
- clause 0 [medium] `apps/web/src/components/cms-pattern-designer/CmsPatternVersionDesigner.review.test.tsx` :: CmsPatternVersionDesigner: Review changes after a conflict shows the newer version beside the unsent draft before any choice
  - rejected: pattern version designer tests; the clause is the 'use pattern' surface (placement form, selector, update-diff), which has no component or Playwright spec
- clause 0 [low] `apps/web/src/components/cms-pattern-designer/CmsPatternVersionDesigner.results.test.tsx` :: CmsPatternVersionDesigner: the idempotency key reuses the key for the unchanged body while the outcome is unknown, then drops it
  - rejected: pattern version designer tests; the clause is the 'use pattern' surface (placement form, selector, update-diff), which has no component or Playwright spec

## P2-S12-AC-046

- clause 3 [high] `apps/worker/src/cms-composition-production-taxonomy-act-tokens.test.ts` :: CMS-03C-03 production port: token mapping (BE03c 1290, 1298-1306, 1375) canonical_overlap
  - rejected: adapter token relay or one-operation representative of a meta obligation over three operations; the capability, overlap check and completion are RPC/pgTAP
- clause 5 [high] `packages/contracts/src/cms-composition/taxonomy-version.test.ts` :: CMS-03C-16 taxonomy version request (D10, OD-1, DEC-135) [P2-S12-AC-124] accepts the exact draft request for a first version and for a successor
  - rejected: adapter token relay or one-operation representative of a meta obligation over three operations; the capability, overlap check and completion are RPC/pgTAP
- clause 5 [high] `packages/contracts/src/cms-composition/taxonomy-selector.test.ts` :: CMS-03C-17 taxonomy selector contract [P2-S12-AC-130] returns the eight-member term with a nullable label and no fallback label
  - rejected: adapter token relay or one-operation representative of a meta obligation over three operations; the capability, overlap check and completion are RPC/pgTAP
- clause 5 [high] `apps/worker/src/cms-composition/taxonomy-definition-write.test.ts` :: taxonomy definition write isolated boundary passes an unquoted exact successor operand and accepts definition version 8
  - rejected: adapter token relay or one-operation representative of a meta obligation over three operations; the capability, overlap check and completion are RPC/pgTAP
- clause 5 [high] `apps/worker/src/cms-composition/taxonomy-selector-read.test.ts` :: CMS-03C-17 selector route serves the strict page with a quoted page-version ETag and no-store
  - rejected: adapter token relay or one-operation representative of a meta obligation over three operations; the capability, overlap check and completion are RPC/pgTAP

## P2-S12-AC-047

- clause 0 [medium] `apps/worker/src/cms-taxonomy-merge-converge-runbook.test.ts` :: cms.taxonomy.merge_converge runbook documents the DEC-194 recovery sweep: the RPC, the per-failed-job key, the bounds and the stop, and no open gap
  - rejected: runbook content test: documents the recovery sweep; the clause is declared failure and recovery across five conditions, proven only by RPC/pgTAP and no single scenario covers them

## P2-S12-AC-048

- clause 0 [high] `apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermForm.test.tsx` :: CmsTaxonomyTermForm: create opens a labelled form, sends the exact request under the active version and shows the result
  - rejected: one clause carries ~14 interaction obligations (single clause for the whole sentence); these component tests cover some of them (native form, focus, unknown outcome, conflict compare) but not announce status, URL for navigation/filter, scoped draft before commit or provenance, and no Playwright spec exists. Needs per-obligation clauses before it can be cited
- clause 0 [high] `apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermForm.focus.test.tsx` :: keyboard focus stays on the paging control (FE03 :898, WCAG 2.4.3) keeps focus on "Load more terms" through every page, then moves it to the choice on the last
  - rejected: one clause carries ~14 interaction obligations (single clause for the whole sentence); these component tests cover some of them (native form, focus, unknown outcome, conflict compare) but not announce status, URL for navigation/filter, scoped draft before commit or provenance, and no Playwright spec exists. Needs per-obligation clauses before it can be cited
- clause 0 [high] `apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermForm.refusals.test.tsx` :: CmsTaxonomyTermForm: the other term action outcomes reports an unknown result without claiming success or failure
  - rejected: one clause carries ~14 interaction obligations (single clause for the whole sentence); these component tests cover some of them (native form, focus, unknown outcome, conflict compare) but not announce status, URL for navigation/filter, scoped draft before commit or provenance, and no Playwright spec exists. Needs per-obligation clauses before it can be cited
- clause 0 [high] `apps/web/src/components/cms-taxonomy-designer/CmsTaxonomyVersionDesigner.conflict.test.tsx` :: CmsTaxonomyVersionDesigner: a compare-and-set conflict compares the newer version beside the unsent draft and rebases only on request
  - rejected: one clause carries ~14 interaction obligations (single clause for the whole sentence); these component tests cover some of them (native form, focus, unknown outcome, conflict compare) but not announce status, URL for navigation/filter, scoped draft before commit or provenance, and no Playwright spec exists. Needs per-obligation clauses before it can be cited
- clause 0 [medium] `apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermForm.actions.test.tsx` :: CmsTaxonomyTermForm: deprecate has a separate review step that names the consequence, Back and Escape return, and commits only there
  - rejected: one clause carries ~14 interaction obligations (single clause for the whole sentence); these component tests cover some of them (native form, focus, unknown outcome, conflict compare) but not announce status, URL for navigation/filter, scoped draft before commit or provenance, and no Playwright spec exists. Needs per-obligation clauses before it can be cited

## P2-S12-AC-050

- clause 0 [low] `apps/worker/src/cms-taxonomy-merge-converge-runbook.test.ts` :: cms.taxonomy.merge_converge runbook names the job type, the RPC, the event, the metric, the alert route and the consumer
  - rejected: runbook content or ledger-order test; no test checks tracker gate lines, feature-ledger assignments, the other runbooks or the architecture graph
- clause 0 [low] `tests/contracts/phase-02-slice-12-ledger-inventory.test.ts` :: Slice 12 ledger inventory: criterion identity lists exactly the tracker criterion IDs, in the same order, once each
  - rejected: runbook content or ledger-order test; no test checks tracker gate lines, feature-ledger assignments, the other runbooks or the architecture graph

## P2-S12-AC-051

- clause 0 [high] `packages/contracts/src/cms-composition/locale-resolution.test.ts` :: CMS-03C-20 locale field resolution (DEC-121, DEC-138) [P2-S12-AC-051] blocks a missing no_fallback field with no_fallback_missing and never resolves it through the chain
  - rejected: contract-level resolution semantics only; the single clause also requires publication blocking and incrementing cms_no_fallback_block_total (metric unbuilt/observability lane) and the CMS-03C-20 provider (pgTAP)

## P2-S12-AC-052

- clause 0 [high] `packages/contracts/src/cms-composition/locale-resolution.test.ts` :: CMS-03C-20 locale field resolution (DEC-121, DEC-138) [P2-S12-AC-052] serves a stale localized field and flags it without ever blocking
  - rejected: contract-level stale serving/flagging only; the single clause also requires exposing the state to editorial reads and cms_locale_stale_total (observability lane) and keeping no_fallback blocking

## P2-S12-AC-055

- clause 4 [high] `apps/worker/src/cms-composition-production-locale.test.ts` :: CMS-03C-04 production locale adapter maps port refusals to exact locked CMS-03C-04 catalog codes
  - rejected: adapter relays a stubbed NOT_FOUND to 404 LOCALE_SOURCE_NOT_FOUND; relay, not the concealment decision

## P2-S12-AC-056

- clause 8 [high] `tests/postgrest/phase-02-slice-12-locale-variant.apispec.ts` :: CMS-03C-04 author a locale variant through the real stack [P2-S12-AC-056] an exact replay, also after a lost response, returns the stored 201 and adds nothing; a changed body under the same key is 409
  - rejected: real-stack case proves a changed BODY under the same key is 409; the clause also names a changed actor, path and version (no actor-change case exists; path and version are pgTAP only)

## P2-S12-AC-057

- clause 8 [high] `apps/worker/src/cms-composition/phase-02-slice-12-dependency-unavailable.test.ts` :: [P2-S12-AC-008] CMS-03C dependency failures are DEPENDENCY_UNAVAILABLE CMS-03C-04 locale variant a port that throws answers 503 DEPENDENCY_UNAVAILABLE without its prose
  - rejected: (duplicate of the throwing-port 503 case; not needed)

## P2-S12-AC-060

- clause 0 [high] `apps/worker/src/cms-composition/related-content-typed-refusals.test.ts` :: CMS-03C-05 typed refusals (BE03c 1304, 1380-1383) publishes capability_missing on the 403 of a visible source without edit
  - rejected: Worker publishes capability_missing on a stubbed 403 only; the clause is the whole authority matrix (404, uniform 422, 403, no access grant), decided by the RPC (pgTAP)

## P2-S12-AC-061

- clause 5 [high] `apps/worker/src/cms-composition/related-content-success.test.ts` :: CMS-03C-05 success and runtime resilience admits a contract-shaped resource to 201 with stable headers
  - rejected: no-store on a stubbed-port 201 only; the Tier 2 latency target has no local test (hosted evidence), so 'no-store and Tier 2' is not proven

## P2-S12-AC-062

- clause 11 [high] `apps/worker/src/cms-composition/related-content-errors.test.ts` :: CMS-03C-05 port failure mapping fails closed after admission while the curated authority is unavailable
  - rejected: fails closed with 503 while the stubbed authority port is unavailable; proves no write by the Worker only, not that the RPC commits no mutation on unresolved target authorization (pgTAP)

## P2-S12-AC-063

- clause 0 [high] `apps/web/src/components/cms-related-content/CmsRelatedContentForm.lists.test.tsx` :: CmsRelatedContentForm: pins moves a pin up and down with explicit controls and announces the new position
  - rejected: one clause carries the whole form obligation list; component tests cover ordered pins, exclusions win, fixed refusal, result heading and the 32-pin bound, but the clause also states the registry-chosen rule, picking only from the readable entry list and the 403/404 split in one sentence, and there is no Playwright spec; needs per-obligation clauses before citation
- clause 0 [high] `apps/web/src/components/cms-related-content/CmsRelatedContentForm.save.test.tsx` :: CmsRelatedContentForm: saving announces the saved rule set and eligible count in the focused result heading, and moves to the next version
  - rejected: one clause carries the whole form obligation list; component tests cover ordered pins, exclusions win, fixed refusal, result heading and the 32-pin bound, but the clause also states the registry-chosen rule, picking only from the readable entry list and the 403/404 split in one sentence, and there is no Playwright spec; needs per-obligation clauses before citation
- clause 0 [high] `apps/web/src/components/cms-related-content/CmsRelatedContentForm.refusals.test.tsx` :: an ineligible target (422 related_target_ineligible) marks the offending pin row with the one fixed message and no other row
  - rejected: one clause carries the whole form obligation list; component tests cover ordered pins, exclusions win, fixed refusal, result heading and the 32-pin bound, but the clause also states the registry-chosen rule, picking only from the readable entry list and the 403/404 split in one sentence, and there is no Playwright spec; needs per-obligation clauses before citation
- clause 0 [medium] `apps/web/src/components/cms-related-content/CmsRelatedContentForm.lists.test.tsx` :: CmsRelatedContentForm: pins stops at 32 pins: the 33rd cannot be chosen
  - rejected: one clause carries the whole form obligation list; component tests cover ordered pins, exclusions win, fixed refusal, result heading and the 32-pin bound, but the clause also states the registry-chosen rule, picking only from the readable entry list and the 403/404 split in one sentence, and there is no Playwright spec; needs per-obligation clauses before citation

## P2-S12-AC-064

- clause 0 [high] `packages/contracts/src/cms-composition/governed-review.test.ts` :: CMS-03C-06 governed review submission contract (DEC-137) [P2-S12-AC-064] composes headers and body into the OpenAPI transport view
  - rejected: contract, Worker and OpenAPI tests cover the request, resource members/bounds and registry row, but no Vitest test computes the JCS SHA-256 contentHash of the named tuple (pgTAP), and the entry is one monolithic clause
- clause 0 [high] `packages/contracts/src/cms-composition/governed-review.test.ts` :: GovernedReviewResource (CMS-03C-06 201, CMS-03C-07 200) [P2-S12-AC-064] accepts the exact open review and carries no ownership, submitter or reviewer identifier
  - rejected: contract, Worker and OpenAPI tests cover the request, resource members/bounds and registry row, but no Vitest test computes the JCS SHA-256 contentHash of the named tuple (pgTAP), and the entry is one monolithic clause
- clause 0 [high] `packages/contracts/src/cms-composition/governed-review.test.ts` :: GovernedReviewResource (CMS-03C-06 201, CMS-03C-07 200) [P2-S12-AC-064] bounds the decision counts 1-8 and 0-8, the capability slots 1-16 and the subject version
  - rejected: contract, Worker and OpenAPI tests cover the request, resource members/bounds and registry row, but no Vitest test computes the JCS SHA-256 contentHash of the named tuple (pgTAP), and the entry is one monolithic clause
- clause 0 [high] `apps/worker/src/cms-composition/governed-review-submit.test.ts` :: CMS-03C-06 submit contract (BE03c row 168, field matrix 389) forwards the exact body and key and carries no validator
  - rejected: contract, Worker and OpenAPI tests cover the request, resource members/bounds and registry row, but no Vitest test computes the JCS SHA-256 contentHash of the named tuple (pgTAP), and the entry is one monolithic clause
- clause 0 [high] `tests/contracts/phase-02-slice-12-governed-review-openapi.test.ts` :: Slice 12 governed review registry rows and generated OpenAPI (CMS-03C-06 to CMS-03C-11) [P2-S12-AC-064] CMS-03C-06 registers POST /api/v1/cms/governed-reviews with its auth, step-up, concurrency, rate and SLO policy
  - rejected: contract, Worker and OpenAPI tests cover the request, resource members/bounds and registry row, but no Vitest test computes the JCS SHA-256 contentHash of the named tuple (pgTAP), and the entry is one monolithic clause
- clause 0 [high] `tests/contracts/phase-02-slice-12-governed-review-openapi.test.ts` :: Slice 12 governed review registry rows and generated OpenAPI (CMS-03C-06 to CMS-03C-11) [P2-S12-AC-064] CMS-03C-06 generates the documented parameters, request body, success statuses and error matrix
  - rejected: contract, Worker and OpenAPI tests cover the request, resource members/bounds and registry row, but no Vitest test computes the JCS SHA-256 contentHash of the named tuple (pgTAP), and the entry is one monolithic clause

## P2-S12-AC-065

- clause 0 [high] `packages/contracts/src/cms-composition/governed-review.test.ts` :: CMS-03C-06 governed review submission contract (DEC-137) [P2-S12-AC-065] refuses an off-grammar subject id, a subject hash that is not 64 lowercase hex and any other member
  - rejected: monolithic clause: Vitest proves only the subject id/hash grammar and the canonical-domain relay; stored-hash mismatch, non-draft/live-review refusal, provider check and the partial unique index are pgTAP, so the clause cannot be cited at the Vitest layer alone (partial candidate for a combined pgTAP+Vitest citation)
- clause 0 [medium] `apps/worker/src/cms-composition/governed-review-refusals.test.ts` :: CMS-03C-06 SQL refusal transport (tokens of 20261013300820) carries the canonical domain of canonical_source_unavailable (BE03c 1375, DEC-180 G11)
  - rejected: monolithic clause: Vitest proves only the subject id/hash grammar and the canonical-domain relay; stored-hash mismatch, non-draft/live-review refusal, provider check and the partial unique index are pgTAP, so the clause cannot be cited at the Vitest layer alone (partial candidate for a combined pgTAP+Vitest citation)

## P2-S12-AC-066

- clause 0 [high] `apps/worker/src/cms-composition/governed-review-refusals.test.ts` :: CMS-03C-06 SQL refusal transport (tokens of 20261013300820) answers a hidden and an absent subject identically (404 concealment)
  - rejected: monolithic clause: Worker tests prove 404 concealment and 403 transport and the capability-before-rate order against stubbed RPC replies; submitted_by derivation, no-identifier serialization and the hidden/absent RPC decision are pgTAP (partial candidate for a combined citation)
- clause 0 [high] `apps/worker/src/cms-composition/governed-review-refusals.test.ts` :: CMS-03C-06 SQL refusal transport (tokens of 20261013300820) keeps a visible subject without the capability a 403, not a 404
  - rejected: monolithic clause: Worker tests prove 404 concealment and 403 transport and the capability-before-rate order against stubbed RPC replies; submitted_by derivation, no-identifier serialization and the hidden/absent RPC decision are pgTAP (partial candidate for a combined citation)
- clause 0 [high] `apps/worker/src/cms-composition/governed-review-headers.test.ts` :: CMS-03C-06 capability, header and preflight admission (BE03c row 168) requires an owner capability (designer or curator) before rate admission
  - rejected: monolithic clause: Worker tests prove 404 concealment and 403 transport and the capability-before-rate order against stubbed RPC replies; submitted_by derivation, no-identifier serialization and the hidden/absent RPC decision are pgTAP (partial candidate for a combined citation)

## P2-S12-AC-067

- clause 0 [high] `apps/worker/src/cms-composition/governed-review-headers.test.ts` :: CMS-03C-06 capability, header and preflight admission (BE03c row 168) accepts no If-Match: a present validator is refused before the RPC
  - rejected: monolithic clause: Worker/contract tests prove Idempotency-Key, no If-Match, 30/60 quotas and the 15 s deadline; the one-transaction freeze/dependency rows/audit are pgTAP and the Tier 2 p95 target has no local test (partial candidate)
- clause 0 [high] `apps/worker/src/cms-composition/governed-review-production.test.ts` :: CMS-03C-06 production transport boundary consumes the user quota (30/min) then the party quota (60/min)
  - rejected: monolithic clause: Worker/contract tests prove Idempotency-Key, no If-Match, 30/60 quotas and the 15 s deadline; the one-transaction freeze/dependency rows/audit are pgTAP and the Tier 2 p95 target has no local test (partial candidate)
- clause 0 [high] `apps/worker/src/cms-composition/governed-review-production.test.ts` :: CMS-03C-06 production transport boundary ends a stalled session at the 15 second route deadline
  - rejected: monolithic clause: Worker/contract tests prove Idempotency-Key, no If-Match, 30/60 quotas and the 15 s deadline; the one-transaction freeze/dependency rows/audit are pgTAP and the Tier 2 p95 target has no local test (partial candidate)
- clause 0 [medium] `packages/contracts/src/cms-composition/governed-review.test.ts` :: CMS-03C-06 governed review submission contract (DEC-137) [P2-S12-AC-067] requires JSON and a bounded idempotency key and refuses any If-Match
  - rejected: monolithic clause: Worker/contract tests prove Idempotency-Key, no If-Match, 30/60 quotas and the 15 s deadline; the one-transaction freeze/dependency rows/audit are pgTAP and the Tier 2 p95 target has no local test (partial candidate)

## P2-S12-AC-068

- clause 0 [high] `apps/worker/src/cms-composition/governed-review-refusals.test.ts` :: CMS-03C-06 SQL refusal transport (tokens of 20261013300820) answers a hidden and an absent subject identically (404 concealment)
  - rejected: Worker 404 concealment transport only; clause is the whole error matrix including NULL workflow-policy evidence 503 and no-state-change (pgTAP)
- clause 0 [high] `apps/worker/src/cms-composition/governed-review-submit.test.ts` :: CMS-03C-06 submit contract (BE03c row 168, field matrix 389) maps a port that throws to a scrubbed 503 and a malformed envelope to 502
  - rejected: Worker 503/502 mapping only
- clause 0 [high] `apps/worker/src/cms-composition/governed-review-submit.test.ts` :: CMS-03C-06 submit contract (BE03c row 168, field matrix 389) rejects malformed JSON before rate admission
  - rejected: malformed JSON only
- clause 0 [high] `packages/contracts/src/cms-composition/error-catalog.test.ts` :: BE03c normative application error catalog [P2-S12-AC-008] maps every status to the exact catalog code and never uses a status as a code
  - rejected: status-to-code catalog (template, locale...) not the governed-review catalog row

## P2-S12-AC-069

- clause 0 [high] `apps/web/src/components/cms-governed-review/CmsGovernedReviewPanel.test.tsx` :: CmsGovernedReviewPanel lifecycle (CMS-03C-06) offers the submit action only for a draft and never asks the person to type anything
  - rejected: one monolithic UI clause (panel across template, pattern and vocabulary pages, each subject kind, one live review per version, 403/404 split, focused heading); jsdom tests cover parts and no Playwright spec exists
- clause 0 [high] `apps/web/src/components/cms-governed-review/CmsGovernedReviewPanel.test.tsx` :: submit for review sends the subject id and hash exactly as served, with no If-Match, then re-reads the subject and names the result
  - rejected: one monolithic UI clause (panel across template, pattern and vocabulary pages, each subject kind, one live review per version, 403/404 split, focused heading); jsdom tests cover parts and no Playwright spec exists
- clause 0 [high] `apps/web/src/components/cms-governed-review/CmsGovernedReviewPanel.test.tsx` :: submit for review says a version that cannot be submitted is not a submittable draft and re-reads the subject
  - rejected: one monolithic UI clause (panel across template, pattern and vocabulary pages, each subject kind, one live review per version, 403/404 split, focused heading); jsdom tests cover parts and no Playwright spec exists
- clause 0 [high] `apps/web/src/components/cms-governed-review/CmsGovernedReviewPanel.test.tsx` :: submit for review renders the capability gate for a missing capability or separation of duties, never a step-up route
  - rejected: one monolithic UI clause (panel across template, pattern and vocabulary pages, each subject kind, one live review per version, 403/404 split, focused heading); jsdom tests cover parts and no Playwright spec exists
- clause 0 [medium] `apps/web/src/components/cms-governed-review/CmsGovernedReviewPanel.submit-form.test.tsx` :: the panel submit form titles its frame with the id the page focuses and marks the button busy only while the command is in flight
  - rejected: one monolithic UI clause (panel across template, pattern and vocabulary pages, each subject kind, one live review per version, 403/404 split, focused heading); jsdom tests cover parts and no Playwright spec exists

## P2-S12-AC-072

- clause 0 [high] `tests/contracts/phase-02-slice-12-governed-review-openapi.test.ts` :: Slice 12 governed review registry rows and generated OpenAPI (CMS-03C-06 to CMS-03C-11) [P2-S12-AC-072] publishes the exact step-up 401 union only for the decision, assignment and activation commands
  - rejected: OpenAPI documents the step-up 401 union; documentation, not the MFA-first behaviour
- clause 1 [medium] `apps/worker/src/cms-composition/governed-review-decision-admission.test.ts` :: CMS-03C-07 capability, recent MFA and quota order (BE03c 216) answers a caller without cms.reviewer with 403 before step-up and quota
  - rejected: Worker answers 403 for a caller without cms.reviewer (capability gate only); the assignment plus standing-grant rule, the 404/403 split and separation of duties are RPC/pgTAP

## P2-S12-AC-073

- clause 0 [high] `apps/worker/src/cms-composition/governed-review-decision.test.ts` :: CMS-03C-07 decision contract (BE03c row 169, field matrix 390) calls cms_record_governed_decision with the CAS operand, key and server context only
  - rejected: forwards the CAS operand and key to a stubbed RPC; forwarding, not enforcement
- clause 5 [high] `apps/worker/src/cms-composition/governed-review-decision-admission.test.ts` :: CMS-03C-07 capability, recent MFA and quota order (BE03c 216) consumes the user quota (30/min) then the party quota (60/min) of cms-governed-decision
  - rejected: 30/60 quotas only; the clause also names the deadline, no-store and a Tier 2 target which has no local test
- clause 5 [high] `apps/worker/src/cms-composition/governed-review-ops-provider.test.ts` :: CMS-03C-07 provider boundary ends a stalled RPC at the 15000 ms route deadline and never retries
  - rejected: 15 s deadline only; same clause also needs Tier 2 and no-store
- clause 5 [medium] `apps/worker/src/cms-composition/governed-review-ops-provider.test.ts` :: CMS-03C-07 provider boundary charges 30/min/user then 60/min/party of cms-governed-decision
  - rejected: charges the quotas only

## P2-S12-AC-074

- clause 7 [medium] `apps/worker/src/cms-composition/governed-review-ops-provider.test.ts` :: CMS-03C-07 provider boundary charges 30/min/user then 60/min/party of cms-governed-decision
  - rejected: (clause 7) quota-order test; the denied-quota 429 cases are cited instead
- clause 7 [medium] `apps/worker/src/cms-composition/governed-review-decision-admission.test.ts` :: CMS-03C-07 capability, recent MFA and quota order (BE03c 216) consumes the user quota (30/min) then the party quota (60/min) of cms-governed-decision
  - rejected: (clause 7) duplicate of #7

## P2-S12-AC-075

- clause 5 [high] `apps/web/src/components/cms-governed-review/CmsGovernedReviewDetailIsland.test.tsx` :: CmsGovernedReviewDetailIsland (CMS-03C-10) refetches the review after a decision and focuses the decisions heading
  - rejected: detail-island refetch focus only; the clause is a verification meta clause that also names the protected policy-slot decision path (database only) and a browser round trip
- clause 5 [medium] `apps/web/src/components/cms-governed-review/CmsGovernedDecisionForm.test.tsx` :: CmsGovernedDecisionForm (CMS-03C-07) keeps the entered text and offers a reconciled retry after a lost answer
  - rejected: reconciled retry after a lost answer; not named in this clause

## P2-S12-AC-076

- clause 2 [medium] `apps/worker/src/cms-composition/governed-review-registry.test.ts` :: agrees on method, path, quota, deadline and step-up
  - rejected: identity not present in any run report (title 'agrees on method, path, quota, deadline and step-up' is not an expanded real identity here)

## P2-S12-AC-077

- clause 0 [high] `packages/contracts/src/cms-composition/governed-assignment.test.ts` :: CMS-03C-08 governed reviewer assignment contract [P2-S12-AC-077] requires an offset-bearing ISO instant for expiresAt and a UUID reviewer
  - rejected: (clause 0) contract proves the ISO instant/UUID grammar only; the bounds against now, the reviewer grant day and the grantor designer/curator grant end (422 expiry_out_of_bounds) are RPC/pgTAP
- clause 0 [high] `packages/contracts/src/cms-composition/governed-assignment.test.ts` :: GovernedReviewAssignmentResource (CMS-03C-08 201/200) [P2-S12-AC-077] keeps the window positive and no longer than exactly seven days
  - rejected: (clause 0) resource window of at most seven days; not the request-side bound against now and the grant days

## P2-S12-AC-078

- clause 0 [medium] `tests/contracts/phase-02-slice-12-governed-review-openapi.test.ts` :: Slice 12 governed review registry rows and generated OpenAPI (CMS-03C-06 to CMS-03C-11) [P2-S12-AC-072] publishes the exact step-up 401 union only for the decision, assignment and activation commands
  - rejected: 1: OpenAPI documents the step-up 401 union (documentation); 2: resource shape of the response, not the grant conferred. The clause is the receipt-derived owner/eligibility/concealment rules and the read+decide-only grant, all RPC/pgTAP
- clause 5 [medium] `packages/contracts/src/cms-composition/governed-assignment.test.ts` :: GovernedReviewAssignmentResource (CMS-03C-08 201/200) [P2-S12-AC-076] refuses another capability, a different action set or order, an unknown state and any identity of the reviewer or grantor
  - rejected: 1: OpenAPI documents the step-up 401 union (documentation); 2: resource shape of the response, not the grant conferred. The clause is the receipt-derived owner/eligibility/concealment rules and the read+decide-only grant, all RPC/pgTAP

## P2-S12-AC-079

- clause 4 [high] `apps/worker/src/cms-composition/governed-review-ops-provider.test.ts` :: CMS-03C-08 provider boundary charges 10/min/user then 20/min/party of cms-governed-assignment
  - rejected: quota charge only; the clause also names the deadline, no-store and a Tier 2 p95 target with no local test
- clause 4 [high] `apps/worker/src/cms-composition/governed-review-ops-provider.test.ts` :: CMS-03C-08 provider boundary ends a stalled RPC at the 15000 ms route deadline and never retries
  - rejected: deadline only; same clause also needs Tier 2

## P2-S12-AC-080

- clause 3 [high] `apps/worker/src/cms-composition/governed-review-assignment.test.ts` :: CMS-03C-08 contract (BE03c row 170, field matrix 391) replays under the same key with byte-identical RPC input, so the database can return the committed outcome
  - rejected: byte-identical RPC input on replay (Worker half); the stored-response replay and no-write are RPC/pgTAP

## P2-S12-AC-081

- clause 6 [medium] `apps/web/src/components/cms-governed-review/CmsGovernedAssignmentForm.test.tsx` :: revoke an assignment lists each active assignment by its label and revokes the one named
  - rejected: revoke list label test; the clause 6 is a verification meta clause (bounds beyond seven days are database-only, assignment_limit copy is in a different file, no browser evidence)
- clause 6 [medium] `apps/web/src/components/cms-governed-review/CmsGovernedAssignmentForm.test.tsx` :: assign a reviewer (create) sends the strict create body at the review version, then refetches and focuses the assignments
  - rejected: create body at the review version; same meta clause

## P2-S12-AC-082

- clause 0 [high] `tests/contracts/phase-02-slice-12-governed-review-openapi.test.ts` :: Slice 12 governed review registry rows and generated OpenAPI (CMS-03C-06 to CMS-03C-11) [P2-S12-AC-082] documents the activation body as a closed three-way choice
  - not selected: no individual verdict recorded: redundant to the cited tests of the same clause, a neighbour/analogue of the clause, or its criterion was left uncited as monolithic (see the criterion limitation)
- clause 3 [medium] `apps/worker/src/cms-composition/governed-review-registry.test.ts` :: documents exactly the statuses of the generated OpenAPI operation
  - rejected: identity 'documents exactly the statuses of the generated OpenAPI operation' is not an expanded real identity in the run (unnamed describe)

## P2-S12-AC-083

- clause 4 [high] `apps/worker/src/cms-composition/governed-activation.test.ts` :: CMS-03C-09 retire (DEC-190: active subject only, review version advances by one) answers a retirement of a non-active subject as the closed 409 subject_not_retirable
  - rejected: Worker maps a stubbed subject_not_retirable 409; the clause is the whole retire rule (active-only, no fresh approval, DEC-190 validity independence, NFC reason), decided by the RPC (pgTAP)

## P2-S12-AC-084

- clause 1 [high] `apps/worker/src/cms-composition/governed-activation-gate.test.ts` :: CMS-03C-09 capability, recent MFA and quota order (BE03c 216, 1326 step 1) admits a taxonomy curator as well (the any-of owner gate); the database decides the subject kind
  - rejected: Worker any-of owner gate admits a curator and leaves the subject-kind decision to the database; not the per-kind owner-capability rule
- clause 1 [high] `apps/worker/src/cms-composition/governed-activation-gate.test.ts` :: CMS-03C-09 capability, recent MFA and quota order (BE03c 216, 1326 step 1) refuses an owner capability revoked after admission
  - rejected: capability revoked after admission; authority-fence, not the 404 or the per-kind rule

## P2-S12-AC-085

- clause 3 [high] `apps/worker/src/cms-composition/governed-activation-gate.test.ts` :: CMS-03C-09 capability, recent MFA and quota order (BE03c 216, 1326 step 1) consumes the user quota (20/min) then the party quota (40/min) of cms-governed-activation
  - rejected: quota charge only; the same clause names a Tier 2 p95 target with no local test
- clause 3 [high] `apps/worker/src/cms-composition/governed-review-ops-provider.test.ts` :: CMS-03C-09 provider boundary ends a stalled RPC at the 15000 ms route deadline and never retries
  - rejected: deadline only; same clause needs Tier 2

## P2-S12-AC-086

- clause 1 [high] `apps/worker/src/cms-composition/governed-activation-time.test.ts` :: CMS-03C-09 schedule: the Worker Time authority (BE03b E8, BE03c 1326 step 6) answers 503 DEPENDENCY_UNAVAILABLE when the pinned snapshot yields no authority, after the quotas
  - rejected: Worker Time authority answers 503 (not the 422 time/tzdb/horizon refusal) when no snapshot yields authority
- clause 3 [high] `apps/worker/src/cms-composition/governed-activation-time.test.ts` :: CMS-03C-09 schedule: the Worker Time authority (BE03b E8, BE03c 1326 step 6) keeps the order MFA, then both quotas, then the time rules
  - rejected: order of checks; not a 422

## P2-S12-AC-087

- clause 7 [high] `apps/web/src/components/cms-governed-review/CmsGovernedActivationForm.schedule.test.tsx` :: schedule commit sends the chosen earlier instant of a repeated local time
  - rejected: schedule earlier-instant case; belongs to the verification meta clause
- clause 7 [high] `apps/web/src/components/cms-governed-review/CmsGovernedActivationForm.recovery.test.tsx` :: unconditional step-up (DEC-111) restores the entries, waits for a new confirmation and resubmits under the original key once
  - rejected: step-up restore; verification meta clause
- clause 7 [medium] `apps/web/src/components/cms-governed-review/governed-review-labels.test.ts` :: governed review labels covers every schedule state and closed reason of DEC-191 exactly
  - rejected: labels coverage; verification meta clause

## P2-S12-AC-088

- clause 2 [medium] `apps/worker/src/cms-composition/governed-review-registry.test.ts` :: is registered
  - rejected: identity 'is registered' is an unnamed-describe title, not a stable expanded identity

## P2-S12-AC-089

- clause 3 [medium] `apps/worker/src/cms-composition/governed-review-reads.test.ts` :: CMS-03C-10 review detail (BE03c row 172) refuses a detail for another review as a local 502
  - rejected: another-review binding (local 502), not the oversized-array refusal

## P2-S12-AC-091

- clause 2 [high] `apps/worker/src/cms-composition/governed-review-ops-provider.test.ts` :: CMS-03C-10 provider boundary charges 300/min/user then 600/min/party of cms-governed-review-read
  - rejected: read-bucket charge only; the same clause names a Tier 1 p95 target with no local test
- clause 2 [high] `apps/worker/src/cms-composition/governed-review-ops-provider.test.ts` :: CMS-03C-10 provider boundary ends a stalled RPC at the 8000 ms route deadline and never retries
  - rejected: deadline only; same clause also needs the Tier 1 target

## P2-S12-AC-092

- clause 2 [medium] `apps/worker/src/cms-composition/governed-review-ops-refusals.test.ts` :: CMS-03C-10 SQL refusal transport adopts a token only from the message, never from prose in details
  - rejected: token adoption; not a named mapping
- clause 3 [high] `apps/web/src/components/cms-governed-review/load-governed-detail-page.test.ts` :: loadGovernedDetailPage answers a hidden, absent or cross-owner review with one identical 404 state
  - rejected: web page loader state, not the API's uniform concealed 404 (RPC/pgTAP)

## P2-S12-AC-093

- clause 0 [high] `apps/web/src/pages/app/cms-content-modeling/definition-reviews/definition-review-routes.test.tsx` :: CMS-03C-10 protected definition-review detail page, composed is never prerendered or cached, uses the one shared shell and bundles no script of its own
  - rejected: (clause 0 candidate) identity 'composed is never prerendered...' is not a real identity; the [reviewId].astro invariants test is cited instead
- clause 3 [high] `apps/web/src/pages/app/cms-content-modeling/definition-reviews/definition-review-routes.test.tsx` :: CMS-03C-10 protected definition-review detail page, composed hands its heading to the shell that loads the heading-focus script
  - rejected: (clause 3 candidate) identity not real; replaced by the [reviewId].astro heading-focus test
- clause 5 [high] `apps/web/src/pages/app/cms-content-modeling/definition-reviews/definition-review-routes.test.tsx` :: CMS-03C-10 protected definition-review detail page, composed answers a hidden, absent or cross-owner review with one closed 404 state
  - rejected: hidden/absent/cross-owner closed 404 state belongs to the verification meta clause
- clause 5 [medium] `apps/web/src/components/cms-governed-review/CmsGovernedReviewDetailIsland.test.tsx` :: CmsGovernedReviewDetailIsland (CMS-03C-10) offers no command on a closed review
  - rejected: closed-review no-command case belongs to the verification meta clause

## P2-S12-AC-095

- clause 1 [medium] `apps/worker/src/cms-composition/governed-review-reads.test.ts` :: CMS-03C-11 review queue (BE03c row 173) forwards the allowlisted filters and the opaque cursor verbatim
  - rejected: forwards the allowlisted filters and cursor verbatim; does not show a body or mutation header refused for the queue

## P2-S12-AC-096

- clause 4 [medium] `apps/web/src/pages/app/cms-content-modeling/definition-reviews/definition-review-routes.test.tsx` :: CMS-03C-11 protected definition-review queue page, composed lets no concealed row, count or identifier through a queue the API answered 403
  - rejected: web queue page lets no concealed row through a 403; UI loader behaviour, not the API scope filter

## P2-S12-AC-097

- clause 0 [high] `apps/worker/src/cms-composition/governed-review-reads.test.ts` :: CMS-03C-11 review queue (BE03c row 173) answers 200 with the strict page, the page-version ETag and the contract defaults applied
  - rejected: 200 with ETag and defaults; does not assert no-store or the absence of mutation members for the queue
- clause 4 [high] `apps/worker/src/cms-composition/governed-review-ops-provider.test.ts` :: CMS-03C-11 provider boundary charges 300/min/user then 600/min/party of cms-governed-review-read
  - rejected: read-bucket charge only; the same clause names a Tier 1 p95 target with no local test
- clause 4 [high] `apps/worker/src/cms-composition/governed-review-ops-provider.test.ts` :: CMS-03C-11 provider boundary ends a stalled RPC at the 8000 ms route deadline and never retries
  - rejected: deadline only; same clause names the Tier 1 target

## P2-S12-AC-098

- clause 1 [high] `apps/web/src/components/cms-governed-review/load-governed-queue-page.test.ts` :: loadGovernedQueuePage answers a refused cursor by dropping only the cursor and marking the restart
  - rejected: web loader drops the cursor on a 409; UI behaviour, the 409 cursor fault itself is RPC/pgTAP

## P2-S12-AC-099

- clause 6 [high] `apps/web/src/components/cms-governed-review/CmsGovernedReviewQueue.test.tsx` :: CmsGovernedReviewQueue (CMS-03C-11) marks the active scope and keeps the filters, never the cursor, when the scope changes
  - rejected: scope-tab/filter retention; belongs to the verification meta clause
- clause 6 [high] `apps/web/src/components/cms-governed-review/load-governed-queue-page.test.ts` :: loadGovernedQueuePage returns the verified page with the URL-owned query for the view
  - rejected: loader returns the verified page; verification meta clause

## P2-S12-AC-100

- clause 2 [low] `apps/web/src/pages/api/v1/cms/patterns/patterns-routes.test.ts` :: first-party CMS-03C-12 endpoint is dynamic and forwards a valid write to the server binding
  - rejected: first-party web proxy forwards a valid write; not the registry row/route parity

## P2-S12-AC-101

- clause 1 [high] `packages/contracts/src/cms-composition/pattern-version.test.ts` :: CMS-03C-12 pattern version request [P2-S12-AC-101] bounds compatibleTypeIds at 1 to 64 unique UUIDs
  - rejected: (clause 1) contract bounds only; 'each the id of an active content type of the caller owner scope' is RPC/pgTAP
- clause 3 [high] `packages/contracts/src/cms-composition/pattern-node.test.ts` :: pattern node schema (D9, OD-2, DEC-175) [P2-S12-AC-101] requires a canonical BlockKey and a positive int32 block version on a block node
  - rejected: (clause 3) canonical BlockKey and positive int32 version only; 'registered, non-withdrawn version' is RPC/pgTAP

## P2-S12-AC-102

- clause 1 [high] `apps/worker/src/cms-composition/pattern-definition-admission.test.ts` :: CMS-03C-12 and cmsPatternLatestRead Worker admission requires an acting party even for a designer
  - rejected: (clause 1) designer-capability presence and acting party are Worker gates; 'in the caller owner scope' is the RPC
- clause 2 [high] `apps/worker/src/cms-composition/pattern-definition-provider-fault.test.ts` :: pattern definition create: provider 4xx without a product token keeps the product answer for structured NOT_FOUND
  - rejected: (clause 2) Worker relay of a stubbed NOT_FOUND; the hidden-owner/pattern concealment is RPC/pgTAP
- clause 3 [high] `apps/worker/src/cms-composition/pattern-definition-production.test.ts` :: CMS-03C-12 typed SQL refusal transport (synthetic replies) projects only the known capability_missing reason
  - rejected: (clause 3) relay of a stubbed capability_missing reason; the 403 is cited from the Worker capability gate instead

## P2-S12-AC-103

- clause 3 [medium] `apps/worker/src/cms-composition/pattern-definition-write.test.ts` :: CMS-03C-12 pattern definition write contract binds an explicitly supplied registry digest to the response
  - rejected: binds a supplied digest to the response; does not show the digest being computed on the server (RPC/pgTAP)
- clause 4 [high] `apps/worker/src/cms-composition/pattern-definition-production.test.ts` :: CMS-03C-12 existing-runtime transport boundary uses the named RPC and server-bound context, not caller authority headers
  - rejected: server-bound context; the clause names a Tier 2 p95 and < 2 s target with no benchmark
- clause 4 [high] `apps/worker/src/cms-composition/pattern-definition-production.test.ts` :: CMS-03C-12 existing-runtime transport boundary ends a stalled session at the 15 second route deadline
  - rejected: deadline only; same clause names Tier 2 and < 2 s targets with no benchmark
- clause 4 [medium] `apps/worker/src/cms-composition/pattern-definition-write.test.ts` :: CMS-03C-12 pattern definition write contract creates the next draft from parent null without requiring step-up
  - rejected: step-up-free create; not a rate/deadline/no-store proof
- clause 4 [high] `tests/contracts/phase-02-slice-12-pattern-openapi.test.ts` :: Slice 12 pattern registry rows and generated OpenAPI (CMS-03C-12 to CMS-03C-15) [P2-S12-AC-100] CMS-03C-12 registers POST /api/v1/cms/patterns/versions with its auth, step-up, concurrency, rate and SLO policy
  - rejected: OpenAPI registration; the clause names latency targets with no benchmark

## P2-S12-AC-104

- clause 0 [medium] `packages/contracts/src/cms-composition/refusals-operations.test.ts` :: BE03c Slice 12 typed refusals per operation [P2-S12-AC-104] CMS-03C-12 may publish exactly the typed refusals the BE03c matrices name, every one in the closed set
  - rejected: (clause 0) catalog-wide typed-refusal publication test, not a 400/401/403 mapping
- clause 2 [high] `apps/worker/src/cms-composition/pattern-definition-production.test.ts` :: CMS-03C-12 typed SQL refusal transport (synthetic replies) projects only the known pattern_cycle reason
  - rejected: (clause 2) projects only pattern_cycle; stale parent/key/version and idempotency conflict are not shown
- clause 2 [medium] `apps/worker/src/cms-composition/pattern-definition-production.test.ts` :: CMS-03C-12 existing-runtime transport boundary bounds an RPC error payload at 262144 bytes
  - rejected: (clause 2) error payload size bound
- clause 5 [medium] `packages/contracts/src/cms-composition/error-catalog.test.ts` :: BE03c normative application error catalog [P2-S12-AC-008] maps every status to the exact catalog code and never uses a status as a code
  - rejected: status-to-code catalog of other operations

## P2-S12-AC-105

- clause 0 [low] `apps/web/src/pages/app/cms-content-modeling/patterns/pattern-pages.test.ts` :: the new-pattern page starts without a saved version
  - rejected: reads the Astro source text for a prop string; weak evidence for 'consumed by' the designer at the route
- clause 0 [low] `apps/web/src/pages/app/cms-content-modeling/patterns/pattern-pages.test.ts` :: the saved-pattern page prefills from the verified latest version
  - rejected: same source-text check
- clause 0 [medium] `apps/web/src/components/cms-pattern-designer/CmsPatternVersionDesigner.test.tsx` :: CmsPatternVersionDesigner: a new pattern builds a tree from the registered blocks and submits the exact request
  - rejected: (clause 1) new-pattern submit of the exact request; the clause also needs nested pattern nodes from CmsPatternSelector which has no web component (CmsPatternNestedPicker is a disabled placeholder)
- clause 1 [medium] `apps/web/src/components/cms-pattern-designer/CmsPatternVersionDesigner.test.tsx` :: CmsPatternVersionDesigner: a new pattern builds a tree from the registered blocks and submits the exact request
  - rejected: (clause 1) new-pattern submit of the exact request; the clause also needs nested pattern nodes from CmsPatternSelector which has no web component (CmsPatternNestedPicker is a disabled placeholder)
- clause 1 [high] `apps/web/src/components/cms-pattern-designer/pattern-designer-request.test.ts` :: buildPatternVersionRequest builds a request the contract accepts and sends no digest
  - rejected: (clause 1) request builder only; same missing CmsPatternSelector source
- clause 1 [medium] `apps/web/src/components/cms-pattern-designer/CmsPatternVersionDesigner.test.tsx` :: CmsPatternVersionDesigner: prerequisites offers every content type as a checkbox
  - rejected: (clause 1) content type checkboxes only
- clause 3 [medium] `apps/web/src/components/cms-pattern-designer/CmsPatternVersionDesigner.test.tsx` :: CmsPatternVersionDesigner: a new pattern builds a tree from the registered blocks and submits the exact request
  - rejected: (clause 1) new-pattern submit of the exact request; the clause also needs nested pattern nodes from CmsPatternSelector which has no web component (CmsPatternNestedPicker is a disabled placeholder)
- clause 3 [medium] `apps/web/src/components/cms-pattern-designer/CmsPatternVersionDesigner.results.test.tsx` :: CmsPatternVersionDesigner: what the server answered says a typed refusal in fixed words and keeps the tree
  - rejected: (clause 3) typed refusal copy keeps the tree; does not show digest/nodeCount nor a node-path refusal inline
- clause 3 [medium] `apps/web/src/components/cms-pattern-designer/pattern-designer-refusal-items.test.ts` :: refusalItems puts an expansion bound at the tree and names no node
  - rejected: (clause 3) expansion bounds name no node, contradicting inline-with-node-path
- clause 5 [high] `apps/web/src/components/cms-pattern-designer/CmsPatternVersionDesigner.test.tsx` :: CmsPatternVersionDesigner: the error summary names the node sends nothing, links each problem to its control and marks it invalid
  - rejected: (clause 5) meta verification clause

## P2-S12-AC-106

- clause 2 [high] `apps/worker/src/cms-composition/pattern-update-answers.test.ts` :: validSelectorPage (CMS-03C-13) accepts several versions of one key in descending version order
  - rejected: (clause 2) accepts descending versions; the 'signed' keyset is the RPC
- clause 2 [medium] `apps/worker/src/cms-composition/pattern-selector-routes.test.ts` :: CMS-03C-13 selector route an answer with rows out of keyset order is a local 502, never a page
  - rejected: (clause 2) out-of-order answer is a local 502; same

## P2-S12-AC-107

- clause 0 [high] `apps/worker/src/cms-composition/pattern-selector-query.test.ts` :: parsePatternSelectorQuery accepts a cursor of exactly 512 characters and refuses 513
  - rejected: (clause 0) cursor bound only; the content type owner scope and the signed cursor are RPC/pgTAP
- clause 0 [high] `apps/worker/src/cms-composition/pattern-selector-query.test.ts` :: parsePatternSelectorQuery applies the default limit of 25 and sends no cursor
  - rejected: (clause 0) default limit only
- clause 1 [high] `apps/worker/src/cms-composition/pattern-selector-routes.test.ts` :: CMS-03C-13 selector route a read carrying an Idempotency-Key is $2
  - rejected: identity with a literal $2 title is not a real identity; the expanded real identities are cited
- clause 2 [high] `apps/worker/src/cms-composition/pattern-selector-routes.test.ts` :: CMS-03C-13 selector route publishes the cursor conflict (409) with no member and the hidden content type as 404
  - rejected: (clause 2) Worker relays a stubbed hidden-content-type 404; the concealment is RPC/pgTAP

## P2-S12-AC-109

- clause 1 [medium] `apps/worker/src/cms-composition/pattern-selector-routes.test.ts` :: CMS-03C-13 selector route passes the signed cursor and the limit through unchanged
  - rejected: passes the cursor through unchanged; the signing and binding are RPC (Vault key)
- clause 4 [high] `apps/worker/src/cms-composition/pattern-update-admission.test.ts` :: CMS-03C-13 admission charges the user bucket then the party bucket of the registry row
  - rejected: charge only; the clause names the Tier 1 p95 target with no benchmark
- clause 4 [high] `apps/worker/src/cms-composition/pattern-update-registry.test.ts` :: the three registry rows CMS-03C-13: GET selector, 300/600 per minute, 8,000 ms
  - rejected: registry row only; same Tier 1 gap
- clause 4 [high] `apps/worker/src/cms-composition/pattern-update-faults.test.ts` :: CMS-03C-13 faults a port that never answers is 504 at the 8000 ms registry deadline
  - rejected: deadline only; same Tier 1 gap

## P2-S12-AC-110

- clause 0 [medium] `apps/worker/src/cms-composition/pattern-selector-routes.test.ts` :: CMS-03C-13 selector route a read carrying an Idempotency-Key is $2
  - rejected: identity with a literal $2 title is not a real identity
- clause 2 [medium] `packages/contracts/src/cms-composition/refusals-operations.test.ts` :: BE03c Slice 12 typed refusals per operation [P2-S12-AC-110] CMS-03C-13 may publish exactly the typed refusals the BE03c matrices name, every one in the closed set
  - rejected: catalog-wide typed refusal set test

## P2-S12-AC-113

- clause 1 [high] `packages/contracts/src/cms-composition/dec193-contract-migration.test.ts` :: DEC-193 typed diff node values and collision kinds [DEC-193][diff-2] requires exactly one collisionKind on a collision and null otherwise
  - rejected: (clause 1) exactly-one-kind shape only; the collision definition and precedence, changed-path listing and newRoots derivation are RPC/pgTAP
- clause 4 [high] `packages/contracts/src/cms-composition/dec193-contract-migration.test.ts` :: DEC-193 typed diff node values and collision kinds [DEC-193][diff-8] preserves the 128-path and 262144-byte diff bounds
  - rejected: (clause 4) contract bound of 128 paths and 262144 bytes; the refusal as 422 diff_too_large is produced by the RPC (pgTAP)

## P2-S12-AC-114

- clause 0 [medium] `apps/worker/src/cms-composition/pattern-update-admission.test.ts` :: CMS-03C-14 admission the designer capability alone is 403 capability_missing with no quota and no port call
  - rejected: contract shape and a stubbed Worker 200 of an empty diff; the conditions (no newer active compatible version, detached/retired/older rows, standalone block row refused) and the assignment/readability rule are RPC/pgTAP
- clause 1 [high] `packages/contracts/src/cms-composition/pattern-update-diff.test.ts` :: CMS-03C-14 update diff contract [P2-S12-AC-114] answers an instance with no newer compatible version as an empty diff at its pinned version
  - rejected: contract shape and a stubbed Worker 200 of an empty diff; the conditions (no newer active compatible version, detached/retired/older rows, standalone block row refused) and the assignment/readability rule are RPC/pgTAP
- clause 1 [high] `apps/worker/src/cms-composition/pattern-update-diff-routes.test.ts` :: CMS-03C-14 update-diff route an instance with no newer version is a 200 with an empty diff, not an error
  - rejected: contract shape and a stubbed Worker 200 of an empty diff; the conditions (no newer active compatible version, detached/retired/older rows, standalone block row refused) and the assignment/readability rule are RPC/pgTAP

## P2-S12-AC-115

- clause 0 [high] `apps/worker/src/cms-composition/pattern-update-diff-routes.test.ts` :: CMS-03C-14 update-diff route a read carrying an Idempotency-Key is $2
  - rejected: identity with a literal $2 title is not a real identity; expanded identities cited
- clause 3 [high] `apps/worker/src/cms-composition/pattern-update-admission.test.ts` :: CMS-03C-14 admission charges the user bucket then the party bucket of the registry row
  - rejected: charge only; clause names the Tier 1 p95 target with no benchmark
- clause 3 [high] `apps/worker/src/cms-composition/pattern-update-faults.test.ts` :: CMS-03C-14 faults a port that never answers is 504 at the 8000 ms registry deadline
  - rejected: deadline only; same
- clause 3 [high] `apps/worker/src/cms-composition/pattern-update-registry.test.ts` :: operation table of CMS-03C-14 matches its registry row rate class, user and party ceilings and a 60-second window
  - rejected: registry/op-table parity only; same

## P2-S12-AC-116

- clause 0 [medium] `packages/contracts/src/cms-composition/refusals-operations.test.ts` :: BE03c Slice 12 typed refusals per operation [P2-S12-AC-116] CMS-03C-14 may publish exactly the typed refusals the BE03c matrices name, every one in the closed set
  - rejected: catalog-wide typed refusal set test

## P2-S12-AC-119

- clause 0 [medium] `apps/worker/src/cms-composition/pattern-update-routes.test.ts` :: CMS-03C-15 pattern-update route an action outside the enum is 422 naming /action, before any quota or port
  - rejected: (clause 0) identity with a literal $2 title; the expanded identity is cited instead
- clause 2 [high] `apps/worker/src/cms-composition/pattern-update-routes.test.ts` :: CMS-03C-15 pattern-update route a repeated instance is 422 naming /instances/1/instanceId, before any quota or port
  - rejected: (clause 2) same
- clause 4 [high] `apps/worker/src/cms-composition/pattern-update-refusals.test.ts` :: CMS-03C-15 pattern-update refusals publishes 422 pattern_version_not_active with exactly its reasonCode
  - rejected: (clause 4) Worker relay of a stubbed pattern_version_not_active 422; 'the latest active compatible version above the pinned one' is decided by the RPC (pgTAP)
- clause 5 [high] `packages/contracts/src/cms-composition/pattern-update.test.ts` :: CMS-03C-15 pattern update request [P2-S12-AC-119] bounds choices at 128 and each choice to a node path and yours or theirs
  - rejected: (clause 5) choice bounds only; 'covering every colliding path ... a missing choice is 422' is the RPC resolver
- clause 5 [high] `apps/worker/src/cms-composition/pattern-update-routes.test.ts` :: CMS-03C-15 pattern-update route choices on a bulk request is 422 naming /instances/0/choices, before any quota or port
  - rejected: (clause 5) same
- clause 5 [medium] `apps/worker/src/cms-composition/pattern-update-routes.test.ts` :: CMS-03C-15 pattern-update route forwards a single-instance accept with its choices
  - rejected: (clause 5) forwards a stubbed single-instance accept
- clause 6 [high] `apps/worker/src/cms-composition/pattern-update-refusals.test.ts` :: CMS-03C-15 pattern-update refusals publishes 409 diff_has_collisions with exactly its reasonCode
  - rejected: (clause 6) Worker relay of a stubbed 409 diff_has_collisions; the determination is the RPC
- clause 8 [high] `apps/worker/src/cms-composition/pattern-update-routes.test.ts` :: CMS-03C-15 pattern-update route an If-Match for another entry version is $2 and starts nothing
  - rejected: (clause 8) identity with a literal $2 title; the expanded identity is cited instead

## P2-S12-AC-120

- clause 0 [medium] `apps/worker/src/cms-composition/pattern-update-admission.test.ts` :: CMS-03C-15 admission the designer capability alone is 403 capability_missing with no quota and no port call
  - rejected: Worker capability gate (designer alone is 403) only; the assigned-author/editor-on-revision scope, 404/403 split, eligibility 422 and version currency are RPC/pgTAP

## P2-S12-AC-121

- clause 0 [high] `apps/worker/src/cms-composition/pattern-update-routes.test.ts` :: CMS-03C-15 pattern-update route a short Idempotency-Key is $2 and starts nothing
  - rejected: identity with a literal $2 title; the expanded identity is cited
- clause 3 [high] `apps/worker/src/cms-composition/pattern-update-admission.test.ts` :: CMS-03C-15 admission charges the user bucket then the party bucket of the registry row
  - rejected: (clause 3) bucket charge only; clause names the Tier 2 target with no benchmark
- clause 3 [high] `apps/worker/src/cms-composition/pattern-update-faults.test.ts` :: CMS-03C-15 faults a port that never answers is 504 at the 15000 ms registry deadline
  - rejected: (clause 3) deadline only; same
- clause 3 [high] `apps/worker/src/cms-composition/pattern-update-admission.test.ts` :: CMS-03C-15 admission a request with no defect is accepted, cached nowhere, with the strong ETag
  - rejected: (clause 3) no-store/ETag only; same
- clause 3 [high] `apps/worker/src/cms-composition/pattern-update-registry.test.ts` :: operation table of CMS-03C-15 matches its registry row rate class, user and party ceilings and a 60-second window
  - not selected: no individual verdict recorded: redundant to the cited tests of the same clause, a neighbour/analogue of the clause, or its criterion was left uncited as monolithic (see the criterion limitation)

## P2-S12-AC-122

- clause 0 [high] `apps/worker/src/cms-composition/pattern-update-refusals.test.ts` :: CMS-03C-15 pattern-update refusals a stale entry or instance version is the plain conflict with the version pair only
  - not selected: no individual verdict recorded: redundant to the cited tests of the same clause, a neighbour/analogue of the clause, or its criterion was left uncited as monolithic (see the criterion limitation)
- clause 0 [high] `apps/worker/src/cms-composition/pattern-update-refusals.test.ts` :: CMS-03C-15 pattern-update refusals publishes 409 diff_has_collisions with exactly its reasonCode
  - not selected: no individual verdict recorded: redundant to the cited tests of the same clause, a neighbour/analogue of the clause, or its criterion was left uncited as monolithic (see the criterion limitation)
- clause 1 [high] `apps/worker/src/cms-composition/pattern-update-refusals.test.ts` :: CMS-03C-15 pattern-update refusals publishes 422 pattern_version_not_active with exactly its reasonCode
  - not selected: no individual verdict recorded: redundant to the cited tests of the same clause, a neighbour/analogue of the clause, or its criterion was left uncited as monolithic (see the criterion limitation)
- clause 2 [high] `apps/worker/src/cms-composition/pattern-update-routes.test.ts` :: CMS-03C-15 pattern-update route a media type other than JSON is $2 and starts nothing
  - rejected: identity with a literal $2 title; expanded identity cited
- clause 2 [medium] `packages/contracts/src/cms-composition/refusals-operations.test.ts` :: BE03c Slice 12 typed refusals per operation [P2-S12-AC-122] CMS-03C-15 may publish exactly the typed refusals the BE03c matrices name, every one in the closed set
  - rejected: catalog-wide typed refusal set test

## P2-S12-AC-124

- clause 0 [medium] `apps/worker/src/cms-composition/taxonomy-definition-admission.test.ts` :: taxonomy definition production-composed Worker admission CMS-03C-16: first version, JSON null and no If-Match reaches typed 401, not generic 404
  - not selected: no individual verdict recorded: redundant to the cited tests of the same clause, a neighbour/analogue of the clause, or its criterion was left uncited as monolithic (see the criterion limitation)

## P2-S12-AC-126

- clause 1 [high] `apps/worker/src/cms-composition/taxonomy-definition-write.test.ts` :: taxonomy definition write isolated boundary requires an acting party before quota
  - rejected: acting party before quota; part of the owner-scope gate (clause 1, RPC)

## P2-S12-AC-127

- clause 0 [medium] `apps/worker/src/cms-composition/taxonomy-definition-write.test.ts` :: taxonomy definition write isolated boundary rejects malformed identity before parsing malformed JSON
  - rejected: malformed identity before JSON; not an Idempotency-Key requirement
- clause 3 [high] `apps/worker/src/cms-composition/taxonomy-definition-write.test.ts` :: taxonomy definition write isolated boundary enforces each quota before mutation: denied scope index 0
  - rejected: quota enforcement only; clause 3 also names the Tier 2 target with no benchmark
- clause 3 [high] `apps/worker/src/cms-composition/taxonomy-registry.test.ts` :: rate table of CMS-03C-16 matches its registry row rate class, user and party ceilings and a 60-second window
  - rejected: rate table parity only; same
- clause 3 [high] `tests/contracts/phase-02-slice-12-taxonomy-version-openapi.test.ts` :: Slice 12 taxonomy registry rows and generated OpenAPI (CMS-03C-16, CMS-03C-17 and the vocabulary reads) [P2-S12-AC-124] CMS-03C-16 registers POST /api/v1/cms/taxonomies/versions with its auth, step-up, concurrency, rate …
  - rejected: registry row OpenAPI; same

## P2-S12-AC-128

- clause 0 [medium] `packages/contracts/src/cms-composition/refusals-operations.test.ts` :: BE03c Slice 12 typed refusals per operation [P2-S12-AC-128] CMS-03C-16 may publish exactly the typed refusals the BE03c matrices name, every one in the closed set
  - rejected: catalog-wide typed refusal set test
- clause 3 [low] `apps/worker/src/cms-composition/taxonomy-definition-write.test.ts` :: taxonomy definition write isolated boundary refuses preflight %s before auth
  - rejected: preflight %s title is not a real expanded identity; no non-JSON 415 case was found for CMS-03C-16
- clause 4 [medium] `packages/contracts/src/cms-composition/taxonomy-version.test.ts` :: CMS-03C-16 taxonomy version request (D10, OD-1, DEC-135) [P2-S12-AC-125] bounds the allowlists at 1 to 64 unique keys of the type and field key grammar
  - rejected: contract allowlist bounds; not the 422 TAXONOMY_VALIDATION_FAILED mapping
- clause 5 [high] `apps/worker/src/cms-composition/taxonomy-definition-write.test.ts` :: taxonomy definition write isolated boundary enforces each quota before mutation: denied scope index 1
  - rejected: quota index 1 only; clause 5 is not cited (no CMS-03C-16 case maps 502/503/504 to DEPENDENCY_UNAVAILABLE)
- clause 5 [medium] `apps/worker/src/cms-composition/taxonomy-definition-admission.test.ts` :: taxonomy provider status and refreshed authority create provider503 cannot become a caller refusal through TAXONOMY_FORBIDDEN
  - rejected: 5xx cannot become a caller refusal; not a mapping to DEPENDENCY_UNAVAILABLE
- clause 5 [medium] `apps/worker/src/cms-composition/taxonomy-definition-provider-fault.test.ts` :: taxonomy definition write: provider 4xx without a product token scrubs PGRST202 function not found to 500 INTERNAL_ERROR
  - rejected: 500 scrub only (clause 5 incomplete)
- clause 5 [high] `apps/worker/src/cms-composition/taxonomy-definition-provider-fault.test.ts` :: taxonomy definition write: a response-contract failure is a retryable 502 answers a malformed 2xx body as 502 with retryable true (BE00 172)
  - rejected: 502 malformed envelope only (clause 5 incomplete)

## P2-S12-AC-129

- clause 0 [low] `apps/web/src/pages/app/cms-content-modeling/taxonomies/taxonomy-pages.test.ts` :: the new-vocabulary page starts without a saved version and carries no term form or review panel
  - rejected: reads the Astro source text; weak evidence for the route consuming the designer
- clause 0 [low] `apps/web/src/pages/app/cms-content-modeling/taxonomies/taxonomy-pages.test.ts` :: the saved-vocabulary page prefills the designer from the verified newest version and its history
  - rejected: same source-text check
- clause 0 [high] `apps/web/src/components/cms-taxonomy-designer/CmsTaxonomyVersionDesigner.test.tsx` :: CmsTaxonomyVersionDesigner: a new vocabulary builds the exact request and shows the saved draft with a link to its page
  - rejected: (clause 0) component-level builds the exact request; the route (/taxonomies/new, /:taxonomyId) consumption is not proven
- clause 0 [high] `apps/web/src/components/cms-taxonomy-designer/CmsTaxonomyVersionDesigner.test.tsx` :: CmsTaxonomyVersionDesigner: a saved vocabulary prefills the rules, keeps the key read-only and lists every version
  - rejected: (clause 0) same
- clause 4 [high] `apps/web/src/components/cms-taxonomy-designer/taxonomy-tags.test.ts` :: addTags stops at 64 keys and says which keys did not fit
  - not selected: no individual verdict recorded: redundant to the cited tests of the same clause, a neighbour/analogue of the clause, or its criterion was left uncited as monolithic (see the criterion limitation)
- clause 4 [high] `apps/web/src/components/cms-taxonomy-designer/taxonomy-designer-request.test.ts` :: buildTaxonomyVersionRequest refuses allowlists past 64 keys and duplicates the contract would refuse
  - not selected: no individual verdict recorded: redundant to the cited tests of the same clause, a neighbour/analogue of the clause, or its criterion was left uncited as monolithic (see the criterion limitation)
- clause 4 [medium] `apps/web/src/components/cms-taxonomy-designer/CmsTaxonomyVersionDesigner.test.tsx` :: CmsTaxonomyVersionDesigner: a new vocabulary names every problem, links each to its control and sends nothing
  - not selected: no individual verdict recorded: redundant to the cited tests of the same clause, a neighbour/analogue of the clause, or its criterion was left uncited as monolithic (see the criterion limitation)

## P2-S12-AC-130

- clause 2 [high] `apps/worker/src/cms-composition/taxonomy-selector-read.test.ts` :: CMS-03C-17 selector route accepts a page ordered by vocabulary key then term key, and the empty page
  - rejected: (clause 2) accepts an ordered page; the 'signed' keyset cursor and the ordering are RPC/pgTAP

## P2-S12-AC-131

- clause 2 [medium] `packages/contracts/src/cms-composition/taxonomy-selector.test.ts` :: CMS-03C-17 taxonomy selector contract [P2-S12-AC-130] returns the eight-member term with a nullable label and no fallback label
  - rejected: (clause 2) contract allows a null label; the null-without-fallback behaviour is RPC/pgTAP

## P2-S12-AC-133

- clause 1 [medium] `apps/worker/src/cms-composition/taxonomy-selector-read.test.ts` :: CMS-03C-17 selector route passes the cursor and the limit through and charges the selector buckets
  - rejected: (clause 1) cursor and limit passed through and buckets charged; the signed keyset binding is RPC, and the clause 4 Tier 1 target has no benchmark
- clause 2 [medium] `apps/worker/src/cms-composition/taxonomy-selector-read.test.ts` :: CMS-03C-17 selector route passes the cursor and the limit through and charges the selector buckets
  - rejected: (clause 1) cursor and limit passed through and buckets charged; the signed keyset binding is RPC, and the clause 4 Tier 1 target has no benchmark
- clause 4 [high] `apps/worker/src/cms-composition/taxonomy-selector-read.test.ts` :: CMS-03C-17 selector route passes the cursor and the limit through and charges the selector buckets
  - rejected: (clause 1) cursor and limit passed through and buckets charged; the signed keyset binding is RPC, and the clause 4 Tier 1 target has no benchmark
- clause 4 [high] `apps/worker/src/cms-composition/taxonomy-registry.test.ts` :: registry rows of the Worker-served taxonomy reads CMS-03C-17: author or editor (any of), GET, no CSRF, no preconditions, 8,000 ms
  - rejected: registry row parity; clause 4 names the Tier 1 target with no benchmark
- clause 4 [low] `apps/worker/src/cms-composition/taxonomy-reads-guards.test.ts` :: CMS-03C-17 guards a deadline that fires during quota bucket 1 stops before the port (504)
  - rejected: deadline during quota; same

## P2-S12-AC-134

- clause 2 [medium] `apps/worker/src/cms-composition/taxonomy-reads-guards.test.ts` :: CMS-03C-17 guards an invalid session envelope is a retryable 502 and the port is never called
  - rejected: session envelope 502 guard; clause 2 is not cited (no CMS-03C-17 500 mapping case and no 429 Retry-After case found)
- clause 2 [medium] `apps/worker/src/cms-composition/taxonomy-reads-guards.test.ts` :: CMS-03C-17 quota dependency faults an invalid limiter envelope is a 502, a limiter refusal is relayed, a wrong ceiling is a 502
  - rejected: limiter envelope guard; same
- clause 2 [medium] `packages/contracts/src/cms-composition/refusals-operations.test.ts` :: BE03c Slice 12 typed refusals per operation [P2-S12-AC-134] CMS-03C-17 may publish exactly the typed refusals the BE03c matrices name, every one in the closed set
  - rejected: catalog-wide typed refusal set test

## P2-S12-AC-142

- clause 0 [high] `packages/contracts/src/cms-composition/governed-activation-job.test.ts` :: CMS-03C-19 scheduled governed activation (OD-6) [P2-S12-AC-142] names the BE00 job type the Worker scheduled sweep runs
  - rejected: (clause 0) job-type name only; 'exactly two database RPCs' is a database fact (pgTAP)
- clause 0 [medium] `apps/worker/src/cms-governed-activation-import-graph.test.ts` :: CMS-03C-19 module boundary (import graph) lets only the scheduled sweep import the claim/execute port, in any form
  - rejected: (clause 0) import graph only
- clause 0 [high] `apps/worker/src/cms-governed-activation-sweep.test.ts` :: executing claims executes each claim in order with the review version and the lease, calling nothing else
  - rejected: (clause 0) sweep executes stubbed claims

## P2-S12-AC-145

- clause 0 [high] `apps/worker/src/cms-governed-activation-sweep.test.ts` :: a quiet tick claims the bounded batch once and logs only the count
  - rejected: monolithic clause: the quiet-tick Worker case proves batch 25 once; the every-minute cron, FOR UPDATE SKIP LOCKED claim, version CAS, five-minute lease and the retry ladder are RPC/pgTAP/race

## P2-S12-AC-147

- clause 0 [high] `packages/contracts/src/cms-composition/governed-activation-job.test.ts` :: CMS-03C-19 scheduled governed activation (OD-6) [P2-S12-AC-147] records the actual instant and deviation of a completed execution
  - rejected: monolithic clause: contract proves the result carries actual instant and deviation, and the operation is out of the browser inventory; the activate switch, atomic event/audit/schedule commit and the verification list are RPC/pgTAP
- clause 0 [high] `tests/contracts/phase-02-slice-12-governed-review-openapi.test.ts` :: Slice 12 governed review registry rows and generated OpenAPI (CMS-03C-06 to CMS-03C-11) [P2-S12-AC-136] keeps the internal CMS-03C-18 to CMS-03C-21 operations and their records out of the browser inventory and OpenAPI
  - rejected: monolithic clause: contract proves the result carries actual instant and deviation, and the operation is out of the browser inventory; the activate switch, atomic event/audit/schedule commit and the verification list are RPC/pgTAP

## P2-S12-AC-148

- clause 0 [high] `packages/contracts/src/cms-composition/locale-resolution.test.ts` :: CMS-03C-20 locale field resolution (DEC-121, DEC-138) [P2-S12-AC-148] takes the entry, the target locale and the field id of the RPC
  - rejected: monolithic clause: the contract proves the request/resolution shapes and the gate registration constants, but the RPC and 'the one resolver used by the 03b provider, the Shard 04 projection and editorial reads' are database/cross-shard facts (not yet wired per the classification)
- clause 0 [high] `packages/contracts/src/cms-composition/locale-resolution.test.ts` :: CMS-03C-20 locale field resolution (DEC-121, DEC-138) [P2-S12-AC-148] returns the nine members with their closed vocabularies
  - rejected: monolithic clause: the contract proves the request/resolution shapes and the gate registration constants, but the RPC and 'the one resolver used by the 03b provider, the Shard 04 projection and editorial reads' are database/cross-shard facts (not yet wired per the classification)
- clause 0 [medium] `packages/contracts/src/cms-composition/locale-resolution.test.ts` :: CMS-03C-20 locale field resolution (DEC-121, DEC-138) [P2-S12-AC-240] registers the no_fallback_gate provider and its three closed failure reasons
  - rejected: monolithic clause: the contract proves the request/resolution shapes and the gate registration constants, but the RPC and 'the one resolver used by the 03b provider, the Shard 04 projection and editorial reads' are database/cross-shard facts (not yet wired per the classification)

## P2-S12-AC-149

- clause 0 [high] `packages/contracts/src/cms-composition/locale-resolution.test.ts` :: CMS-03C-20 locale field resolution (DEC-121, DEC-138) [P2-S12-AC-149] walks the fallback chain for a localized field and records where the value came from
  - rejected: monolithic clause whose substance is the database resolver (mode walk over the stored fallback chains); the contract test validates the resolution record shape and the chain bound is a configuration rule (pgTAP)

## P2-S12-AC-150

- clause 0 [high] `apps/worker/src/cms-composition/locale-routes-refusals.test.ts` :: CMS-03C-04 locale authoring route [P2-S12-AC-150] keeps the CMS-03C-20 resolver out of the browser route inventory and the locale app
  - rejected: monolithic clause: Vitest proves only the 'absent from the browser inventory and OpenAPI' half; EXECUTE grants revoked from PUBLIC/anon/authenticated and the registered-callers half are pgTAP and not yet wired
- clause 0 [high] `tests/contracts/phase-02-slice-12-governed-review-openapi.test.ts` :: Slice 12 governed review registry rows and generated OpenAPI (CMS-03C-06 to CMS-03C-11) [P2-S12-AC-136] keeps the internal CMS-03C-18 to CMS-03C-21 operations and their records out of the browser inventory and OpenAPI
  - rejected: monolithic clause: Vitest proves only the 'absent from the browser inventory and OpenAPI' half; EXECUTE grants revoked from PUBLIC/anon/authenticated and the registered-callers half are pgTAP and not yet wired

## P2-S12-AC-153

- clause 0 [high] `packages/contracts/src/cms-composition/related-public-target.test.ts` :: CMS-03C-21 related public targets (D11, OD-5) [P2-S12-AC-153] takes the source entry, the locale and the audience of the RPC
  - rejected: monolithic clause: contract shapes and the no-browser-route probe cover the record bounds and the absence half; the database RPC signature and ordering are pgTAP
- clause 0 [high] `packages/contracts/src/cms-composition/related-public-target.test.ts` :: CMS-03C-21 related public targets (D11, OD-5) [P2-S12-AC-153] bounds position 0 to 127 and the reason code grammar and refuses any other member
  - rejected: monolithic clause: contract shapes and the no-browser-route probe cover the record bounds and the absence half; the database RPC signature and ordering are pgTAP
- clause 0 [high] `apps/worker/src/cms-composition/related-content-no-public-targets-route.test.ts` :: CMS-03C-21 has no browser route (BE03c 190) answers 404 or 405 for GET /api/v1/cms/related-content/public-targets
  - rejected: monolithic clause: contract shapes and the no-browser-route probe cover the record bounds and the absence half; the database RPC signature and ordering are pgTAP
- clause 0 [high] `tests/contracts/phase-02-slice-12-governed-review-openapi.test.ts` :: Slice 12 governed review registry rows and generated OpenAPI (CMS-03C-06 to CMS-03C-11) [P2-S12-AC-136] keeps the internal CMS-03C-18 to CMS-03C-21 operations and their records out of the browser inventory and OpenAPI
  - rejected: monolithic clause: contract shapes and the no-browser-route probe cover the record bounds and the absence half; the database RPC signature and ordering are pgTAP

## P2-S12-AC-154

- clause 0 [high] `packages/contracts/src/cms-composition/related-public-target.test.ts` :: CMS-03C-21 related public targets (D11, OD-5) [P2-S12-AC-154] returns at most 128 targets, pins first in position order and then derived candidates in rank order
  - rejected: monolithic clause: contract bounds and orders a list; eligibility, rank order, exclusion removal and refill are RPC/pgTAP

## P2-S12-AC-158

- clause 0 [high] `apps/worker/src/cms-composition/related-content-no-public-targets-route.test.ts` :: CMS-03C-21 has no browser route (BE03c 190) answers 404 or 405 for GET /api/v1/cms/related-content/public-targets
  - rejected: monolithic clause: only the 'absent from browser routes' fragment is a Vitest fact; the consumers (Shard 04 projection, Slice 11 recheck) are not wired and the rest is RPC/pgTAP

## P2-S12-AC-159

- clause 3 [high] `tests/postgrest/phase-02-slice-12-template-reads.apispec.ts` :: cmsTemplateContextRead through the real stack [P2-S12-AC-159] [P2-S12-AC-161] returns only the caller owner's active content types, strictly, with no-store
  - rejected: (clause 3) real-stack case proves owner scope and active versions with no-store; compiled-artifact-only selection is not isolated (an uncompiled/draft type exclusion case is missing)
- clause 4 [medium] `packages/contracts/src/cms-composition/template.test.ts` :: CMS-03C-01 template definition contracts accepts only a bounded, disclosure-safe designer context
  - rejected: (clause 4) contract allows a bounded context; no test builds 129 blocks or excludes other-owner or unsupported blocks

## P2-S12-AC-161

- clause 1 [high] `tests/postgrest/phase-02-slice-12-template-reads.apispec.ts` :: cmsTemplateContextRead through the real stack [P2-S12-AC-161] no session is 401, no designer capability is 403, and a revoked database grant is 403 from the database
  - rejected: real-stack/Worker cases prove the 401, the missing-capability 403 and a revoked database grant; the recheck of actor, acting party and confirmed membership against cms_template_context and 'never reserves permission for a later write' have no direct test (pgTAP predicate-helper only)
- clause 1 [medium] `apps/worker/src/cms-composition/template-context-routes.test.ts` :: CMS-11 protected template context read denies missing designer authority before invoking the RPC
  - rejected: real-stack/Worker cases prove the 401, the missing-capability 403 and a revoked database grant; the recheck of actor, acting party and confirmed membership against cms_template_context and 'never reserves permission for a later write' have no direct test (pgTAP predicate-helper only)

## P2-S12-AC-162

- clause 2 [low] `apps/worker/src/cms-composition/template-context-routes.test.ts` :: CMS-11 protected template context read publishes the BE00 429 details and RateLimit headers on the context route
  - rejected: 429 header contract on the context route and the detail route's rate-class scope; neither asserts that BOTH the user and party buckets are consulted with limit 60 on the context route; the Tier 2 target has no latency evidence
- clause 2 [low] `apps/worker/src/cms-composition/template-detail-routes.test.ts` :: CMS-11 protected current-template detail HTTP route uses the existing read-rate class for both actor and party
  - rejected: 429 header contract on the context route and the detail route's rate-class scope; neither asserts that BOTH the user and party buckets are consulted with limit 60 on the context route; the Tier 2 target has no latency evidence

## P2-S12-AC-164

- clause 3 [high] `apps/web/src/components/cms-pattern-designer/load-pattern-designer-page.test.ts` :: loadPatternDesignerPage: a new pattern redirects an expired session to sign-in and back to the new-pattern page
  - rejected: (clause 3) pattern designer loader redirect only; the clause names three designers and the template-designer 401/403/429 behaviours are asserted only as source substrings
- clause 3 [high] `apps/web/src/components/cms-pattern-designer/load-pattern-designer-page.test.ts` :: loadPatternDesignerPage: a new pattern keeps the wait of a rate limit
  - rejected: (clause 3) pattern loader rate-wait only; same
- clause 3 [high] `apps/web/src/components/cms-pattern-designer/load-pattern-designer-page.test.ts` :: loadPatternDesignerPage: a new pattern renders nothing from a context that is not the strict projection
  - rejected: (clause 3) strict projection (pattern loader); same
- clause 3 [medium] `apps/web/src/components/cms-composition/CmsTemplateDesigner.test.tsx` :: CMS-11 template designer shell disables submission when a selector or CSRF prerequisite is absent
  - rejected: (clause 3) template designer shell disables on absent prerequisite (types/CSRF) only; same
- clause 3 [low] `apps/web/src/pages/app/cms-content-modeling/templates/template-designer-route.test.ts` :: CMS-11 protected template designer page redirects an expired session and never turns denial/degradation into a form
  - rejected: (clause 3) Astro source substrings, weak evidence
- clause 4 [low] `apps/web/src/components/cms-pattern-designer/pattern-designer-static-closure.test.ts` :: pattern islands: static import closure reaches the contracts only through the zod-free browser entry
  - not selected: no individual verdict recorded: redundant to the cited tests of the same clause, a neighbour/analogue of the clause, or its criterion was left uncited as monolithic (see the criterion limitation)
- clause 5 [high] `apps/worker/src/cms-composition/pattern-definition-provider-boundary.test.ts` :: create provider boundary regressions refuses designer capability revoked after rate admission
  - not selected: no individual verdict recorded: redundant to the cited tests of the same clause, a neighbour/analogue of the clause, or its criterion was left uncited as monolithic (see the criterion limitation)
- clause 5 [medium] `apps/worker/src/cms-composition/pattern-definition-admission.test.ts` :: CMS-03C-12 and cmsPatternLatestRead Worker admission requires a designer capability before rate admission
  - not selected: no individual verdict recorded: redundant to the cited tests of the same clause, a neighbour/analogue of the clause, or its criterion was left uncited as monolithic (see the criterion limitation)
- clause 5 [medium] `apps/web/src/components/cms-pattern-designer/CmsPatternVersionDesigner.results.test.tsx` :: CmsPatternVersionDesigner: what the server answered shows a missing capability without a link
  - not selected: no individual verdict recorded: redundant to the cited tests of the same clause, a neighbour/analogue of the clause, or its criterion was left uncited as monolithic (see the criterion limitation)
- clause 5 [medium] `apps/web/src/components/cms-pattern-designer/CmsPatternVersionDesigner.results.test.tsx` :: CmsPatternVersionDesigner: what the server answered waits out a rate limit before another submit
  - not selected: no individual verdict recorded: redundant to the cited tests of the same clause, a neighbour/analogue of the clause, or its criterion was left uncited as monolithic (see the criterion limitation)

## P2-S12-AC-168

- clause 3 [medium] `apps/worker/src/cms-composition/template-detail-routes.test.ts` :: CMS-11 protected current-template detail HTTP route uses the existing read-rate class for both actor and party
  - rejected: read-rate scope and 429 headers; the 60-second window ('/min') is passed by the route and never asserted, and the Tier 2 target has no latency evidence
- clause 3 [medium] `apps/worker/src/cms-composition/template-detail-routes.test.ts` :: CMS-11 protected current-template detail HTTP route publishes the BE00 429 details and RateLimit headers on the detail route
  - rejected: read-rate scope and 429 headers; the 60-second window ('/min') is passed by the route and never asserted, and the Tier 2 target has no latency evidence

## P2-S12-AC-169

- clause 2 [medium] `packages/contracts/src/cms-composition/error-catalog.test.ts` :: BE03c normative application error catalog [P2-S12-AC-008] maps every status to the exact catalog code and never uses a status as a code
  - rejected: status-to-code catalog of other operations (template read code is asserted by the real-stack case instead)
- clause 8 [high] `packages/contracts/src/cms-composition/error-catalog.test.ts` :: BE03c normative application error catalog [P2-S12-AC-008] names the six catalogs with their exact ids and operation tokens
  - not selected: no individual verdict recorded: redundant to the cited tests of the same clause, a neighbour/analogue of the clause, or its criterion was left uncited as monolithic (see the criterion limitation)
- clause 8 [high] `packages/contracts/src/cms-composition/error-catalog.test.ts` :: BE03c normative application error catalog [P2-S12-AC-274] resolves an operation to its catalog, shared catalogs included
  - not selected: no individual verdict recorded: redundant to the cited tests of the same clause, a neighbour/analogue of the clause, or its criterion was left uncited as monolithic (see the criterion limitation)
- clause 8 [medium] `packages/contracts/src/cms-composition/refusals-operations.test.ts` :: BE03c Slice 12 typed refusals per operation [P2-S12-AC-169] cmsTemplateLatestRead may publish exactly the typed refusals the BE03c matrices name, every one in the closed set
  - not selected: no individual verdict recorded: redundant to the cited tests of the same clause, a neighbour/analogue of the clause, or its criterion was left uncited as monolithic (see the criterion limitation)
- clause 9 [medium] `apps/web/src/components/cms-composition/cms-template-edit-reconcile.retry.test.ts` :: readLatestCmsTemplateVersion retry (FE03 :1173) retries a declared-retryable 502 after 250 ms, then 750 ms, and uses the version that answers
  - not selected: no individual verdict recorded: redundant to the cited tests of the same clause, a neighbour/analogue of the clause, or its criterion was left uncited as monolithic (see the criterion limitation)
- clause 9 [low] `apps/web/src/components/cms-composition/cms-template-edit-reconcile.retry.test.ts` :: readLatestCmsTemplateVersion retry (FE03 :1173) is unavailable after the second retry still answers a declared 503
  - not selected: no individual verdict recorded: redundant to the cited tests of the same clause, a neighbour/analogue of the clause, or its criterion was left uncited as monolithic (see the criterion limitation)

## P2-S12-AC-170

- clause 6 [high] `apps/web/src/components/cms-composition/CmsTemplateEditDesigner.interaction.test.tsx` :: CMS-11 successor edit and reconciliation keeps unsent values through conflict and requires an explicit latest-version rebase
  - not selected: no individual verdict recorded: redundant to the cited tests of the same clause, a neighbour/analogue of the clause, or its criterion was left uncited as monolithic (see the criterion limitation)
- clause 6 [high] `apps/web/src/components/cms-composition/cms-template-designer-request.test.ts` :: CMS-11 template draft request loads every editable field from canonical detail and builds a version-checked successor
  - not selected: no individual verdict recorded: redundant to the cited tests of the same clause, a neighbour/analogue of the clause, or its criterion was left uncited as monolithic (see the criterion limitation)
- clause 6 [high] `apps/web/src/components/cms-composition/cms-template-edit-reconcile.test.ts` :: CMS-11 canonical reconciliation read reads only the same-origin protected latest version and checks identity and ETag
  - not selected: no individual verdict recorded: redundant to the cited tests of the same clause, a neighbour/analogue of the clause, or its criterion was left uncited as monolithic (see the criterion limitation)
- clause 6 [medium] `tests/e2e/phase-02-slice-12-template-real-route.spec.ts` :: CMS-11 keeps a stale tab’s unsent values through a real-route conflict and explicit rebase
  - not selected: no individual verdict recorded: redundant to the cited tests of the same clause, a neighbour/analogue of the clause, or its criterion was left uncited as monolithic (see the criterion limitation)

## P2-S12-AC-172

- clause 0 [high] `packages/contracts/src/cms-composition/pattern-version.test.ts` :: cmsPatternLatestRead path contract [P2-S12-AC-172] accepts only a grammar-valid, non-reserved path patternKey and no other member
  - rejected: monolithic clause: Vitest proves the path grammar and reserved keys (contract and proxy admission), the unsupported-header and body refusals and a stubbed indistinguishable 404; 'resolves it only within the caller's owner scope' and the real hidden/absent 404 are RPC/pgTAP (partial candidate for a combined citation)
- clause 0 [high] `apps/worker/src/cms-composition/pattern-definition-latest.test.ts` :: cmsPatternLatestRead immutable definition projection rejects malformed path or unexpected query /api/v1/cms/patterns/Invalid_Key
  - rejected: monolithic clause: Vitest proves the path grammar and reserved keys (contract and proxy admission), the unsupported-header and body refusals and a stubbed indistinguishable 404; 'resolves it only within the caller's owner scope' and the real hidden/absent 404 are RPC/pgTAP (partial candidate for a combined citation)
- clause 0 [high] `apps/worker/src/cms-composition/pattern-definition-latest.test.ts` :: cmsPatternLatestRead immutable definition projection rejects the unsupported latest-read header if-match
  - rejected: monolithic clause: Vitest proves the path grammar and reserved keys (contract and proxy admission), the unsupported-header and body refusals and a stubbed indistinguishable 404; 'resolves it only within the caller's owner scope' and the real hidden/absent 404 are RPC/pgTAP (partial candidate for a combined citation)
- clause 0 [high] `apps/worker/src/cms-composition/pattern-definition-latest.test.ts` :: cmsPatternLatestRead immutable definition projection keeps an absent or policy-hidden definition indistinguishable
  - rejected: monolithic clause: Vitest proves the path grammar and reserved keys (contract and proxy admission), the unsupported-header and body refusals and a stubbed indistinguishable 404; 'resolves it only within the caller's owner scope' and the real hidden/absent 404 are RPC/pgTAP (partial candidate for a combined citation)
- clause 0 [high] `apps/web/src/server/cms-pattern-platform-latest.test.ts` :: cmsPatternLatestRead proxy: admission (nothing reaches the Worker) refuses the reserved key selector
  - rejected: monolithic clause: Vitest proves the path grammar and reserved keys (contract and proxy admission), the unsupported-header and body refusals and a stubbed indistinguishable 404; 'resolves it only within the caller's owner scope' and the real hidden/absent 404 are RPC/pgTAP (partial candidate for a combined citation)

## P2-S12-AC-173

- clause 0 [high] `apps/worker/src/cms-composition/pattern-definition-admission.test.ts` :: CMS-03C-12 and cmsPatternLatestRead Worker admission requires a designer capability before rate admission
  - rejected: monolithic clause: the Worker capability gate is Vitest-provable but the owner-scope resolution and the other-owner identical-key 404 are RPC/pgTAP (no same-key-two-owners pattern case exists; partial candidate)
- clause 0 [low] `apps/worker/src/cms-composition/pattern-definition-latest.test.ts` :: cmsPatternLatestRead immutable definition projection refuses an unbound or private provider projection: {"ownerId":"private"}
  - rejected: monolithic clause: the Worker capability gate is Vitest-provable but the owner-scope resolution and the other-owner identical-key 404 are RPC/pgTAP (no same-key-two-owners pattern case exists; partial candidate)

## P2-S12-AC-174

- clause 0 [high] `apps/worker/src/cms-composition/pattern-definition-production.test.ts` :: cmsPatternLatestRead existing-runtime transport boundary uses the named RPC and server-bound context, not caller authority headers
  - rejected: monolithic clause: Worker cases cover no-store/ETag, header refusals, buckets and the deadline, but the same clause names the Tier 2 target, for which no benchmark exists
- clause 0 [high] `apps/worker/src/cms-composition/pattern-definition-production.test.ts` :: cmsPatternLatestRead existing-runtime transport boundary ends a stalled session at the 15 second route deadline
  - rejected: monolithic clause: Worker cases cover no-store/ETag, header refusals, buckets and the deadline, but the same clause names the Tier 2 target, for which no benchmark exists
- clause 0 [high] `apps/worker/src/cms-composition/pattern-definition-latest.test.ts` :: cmsPatternLatestRead immutable definition projection returns latest draft with the definition version ETag
  - rejected: monolithic clause: Worker cases cover no-store/ETag, header refusals, buckets and the deadline, but the same clause names the Tier 2 target, for which no benchmark exists
- clause 0 [high] `apps/worker/src/cms-composition/pattern-definition-latest.test.ts` :: cmsPatternLatestRead immutable definition projection rejects the unsupported latest-read header idempotency-key
  - rejected: monolithic clause: Worker cases cover no-store/ETag, header refusals, buckets and the deadline, but the same clause names the Tier 2 target, for which no benchmark exists

## P2-S12-AC-175

- clause 0 [medium] `packages/contracts/src/cms-composition/refusals-operations.test.ts` :: BE03c Slice 12 typed refusals per operation [P2-S12-AC-175] cmsPatternLatestRead may publish exactly the typed refusals the BE03c matrices name, every one in the closed set
  - rejected: catalog-wide typed refusal set test

## P2-S12-AC-176

- clause 0 [medium] `apps/web/src/components/cms-governed-review/CmsGovernedPatternPanel.test.tsx` :: CmsGovernedPatternPanel shows the review summary it was served and links to that review
  - not selected: no individual verdict recorded: redundant to the cited tests of the same clause, a neighbour/analogue of the clause, or its criterion was left uncited as monolithic (see the criterion limitation)

## P2-S12-AC-178

- clause 0 [high] `packages/contracts/src/cms-composition/taxonomy-version.test.ts` :: TaxonomyVersionResource and cmsTaxonomyVersionsRead [P2-S12-AC-178] accepts only a UUID lineage taxonomyId path
  - rejected: monolithic clause: Vitest proves the lineage UUID path, the query-key and write-header refusals; 'a hidden or absent vocabulary answers the same 404' is RPC/pgTAP (partial candidate for a combined citation)
- clause 0 [high] `apps/worker/src/cms-composition/taxonomy-definition-versions.test.ts` :: taxonomy versions isolated boundary rejects query ?ownerId=private
  - rejected: monolithic clause: Vitest proves the lineage UUID path, the query-key and write-header refusals; 'a hidden or absent vocabulary answers the same 404' is RPC/pgTAP (partial candidate for a combined citation)
- clause 0 [high] `apps/worker/src/cms-composition/taxonomy-definition-versions.test.ts` :: taxonomy versions isolated boundary rejects write/body header if-match
  - rejected: monolithic clause: Vitest proves the lineage UUID path, the query-key and write-header refusals; 'a hidden or absent vocabulary answers the same 404' is RPC/pgTAP (partial candidate for a combined citation)
- clause 0 [high] `apps/worker/src/cms-composition/taxonomy-definition-versions.test.ts` :: taxonomy versions isolated boundary rejects invalid lineage path and content type
  - rejected: monolithic clause: Vitest proves the lineage UUID path, the query-key and write-header refusals; 'a hidden or absent vocabulary answers the same 404' is RPC/pgTAP (partial candidate for a combined citation)

## P2-S12-AC-179

- clause 0 [high] `apps/worker/src/cms-composition/taxonomy-definition-production.test.ts` :: taxonomy fixed production RPC boundary preserves hidden 404 instead of returning an empty versions page
  - rejected: monolithic clause: the Worker preserves a hidden 404 from a stubbed RPC reply; the owner-scope decision, the capability 403 over the owner's lineage and the absence of authority fields are RPC/pgTAP and shape tests

## P2-S12-AC-180

- clause 0 [high] `apps/worker/src/cms-composition/taxonomy-definition-versions.test.ts` :: taxonomy versions isolated boundary returns newest-first versions and a page-version strong ETag without MFA
  - rejected: monolithic clause: Worker/registry cases cover no-store, ETag, header refusals, buckets and the deadline, but the same clause names the Tier 1 p95 < 750 ms target, for which no benchmark exists
- clause 0 [high] `apps/worker/src/cms-composition/taxonomy-definition-versions.test.ts` :: taxonomy versions isolated boundary rejects write/body header idempotency-key
  - rejected: monolithic clause: Worker/registry cases cover no-store, ETag, header refusals, buckets and the deadline, but the same clause names the Tier 1 p95 < 750 ms target, for which no benchmark exists
- clause 0 [high] `tests/contracts/phase-02-slice-12-taxonomy-version-openapi.test.ts` :: Slice 12 taxonomy registry rows and generated OpenAPI (CMS-03C-16, CMS-03C-17 and the vocabulary reads) [P2-S12-AC-177] cmsTaxonomyVersionsRead registers GET /api/v1/cms/taxonomies/{taxonomyId}/versions with its auth, st…
  - rejected: monolithic clause: Worker/registry cases cover no-store, ETag, header refusals, buckets and the deadline, but the same clause names the Tier 1 p95 < 750 ms target, for which no benchmark exists
- clause 0 [high] `apps/worker/src/cms-composition/taxonomy-registry.test.ts` :: rate table of cmsTaxonomyVersionsRead matches its registry row rate class, user and party ceilings and a 60-second window
  - rejected: monolithic clause: Worker/registry cases cover no-store, ETag, header refusals, buckets and the deadline, but the same clause names the Tier 1 p95 < 750 ms target, for which no benchmark exists

## P2-S12-AC-181

- clause 0 [medium] `packages/contracts/src/cms-composition/refusals-operations.test.ts` :: BE03c Slice 12 typed refusals per operation [P2-S12-AC-181] cmsTaxonomyVersionsRead may publish exactly the typed refusals the BE03c matrices name, every one in the closed set
  - rejected: monolithic clause: Worker cases cover the 404 preservation, a 502 envelope and the 503 'not a caller refusal' guard, but the clause lists 400/401/403/404/415/422/429/502-504/500 with 'query-bound failure (422)' and 'cursor (400)' that do not apply to a path-only read (wording to verify); no real-stack case exists
- clause 0 [medium] `apps/worker/src/cms-composition/taxonomy-definition-admission.test.ts` :: taxonomy provider status and refreshed authority read provider503 cannot become a caller refusal through TAXONOMY_FORBIDDEN
  - rejected: monolithic clause: Worker cases cover the 404 preservation, a 502 envelope and the 503 'not a caller refusal' guard, but the clause lists 400/401/403/404/415/422/429/502-504/500 with 'query-bound failure (422)' and 'cursor (400)' that do not apply to a path-only read (wording to verify); no real-stack case exists
- clause 0 [high] `apps/worker/src/cms-composition/taxonomy-definition-production.test.ts` :: taxonomy fixed production RPC boundary preserves hidden 404 instead of returning an empty versions page
  - rejected: monolithic clause: Worker cases cover the 404 preservation, a 502 envelope and the 503 'not a caller refusal' guard, but the clause lists 400/401/403/404/415/422/429/502-504/500 with 'query-bound failure (422)' and 'cursor (400)' that do not apply to a path-only read (wording to verify); no real-stack case exists
- clause 0 [medium] `apps/worker/src/cms-composition/taxonomy-definition-provider-fault.test.ts` :: taxonomy versions read: a response-contract failure is a retryable 502 answers a malformed 2xx body as 502 with retryable true (BE00 172)
  - rejected: monolithic clause: Worker cases cover the 404 preservation, a 502 envelope and the 503 'not a caller refusal' guard, but the clause lists 400/401/403/404/415/422/429/502-504/500 with 'query-bound failure (422)' and 'cursor (400)' that do not apply to a path-only read (wording to verify); no real-stack case exists

## P2-S12-AC-182

- clause 0 [high] `apps/web/src/components/cms-taxonomy-designer/taxonomy-versions-read.test.ts` :: verifiedVersionsPage keeps exactly the members the pages use, newest first
  - rejected: monolithic UI clause: component tests cover the version list, subject mapping and active-version gating, but 'review summary and permitted actions' and the page-level 403/404 split (loader) were not confirmed in one assertion set and no Playwright spec exists for /taxonomies/:taxonomyId (partial candidate)
- clause 0 [high] `apps/web/src/components/cms-taxonomy-designer/CmsTaxonomyVersionDesigner.test.tsx` :: CmsTaxonomyVersionDesigner: a saved vocabulary prefills the rules, keeps the key read-only and lists every version
  - rejected: monolithic UI clause: component tests cover the version list, subject mapping and active-version gating, but 'review summary and permitted actions' and the page-level 403/404 split (loader) were not confirmed in one assertion set and no Playwright spec exists for /taxonomies/:taxonomyId (partial candidate)
- clause 0 [high] `apps/web/src/components/cms-governed-review/CmsGovernedTaxonomyPanel.test.tsx` :: readTaxonomySubject maps the newest version of the vocabulary to the panel subject
  - rejected: monolithic UI clause: component tests cover the version list, subject mapping and active-version gating, but 'review summary and permitted actions' and the page-level 403/404 split (loader) were not confirmed in one assertion set and no Playwright spec exists for /taxonomies/:taxonomyId (partial candidate)
- clause 0 [high] `apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermForm.test.tsx` :: CmsTaxonomyTermForm: the term list renders no action control against a vocabulary with no active version, and links its review
  - rejected: monolithic UI clause: component tests cover the version list, subject mapping and active-version gating, but 'review summary and permitted actions' and the page-level 403/404 split (loader) were not confirmed in one assertion set and no Playwright spec exists for /taxonomies/:taxonomyId (partial candidate)
- clause 0 [medium] `apps/web/src/components/cms-taxonomy-pages/load-taxonomy-page.test.ts` :: loadTaxonomyPage: a saved vocabulary the newest-50 bound on finding the active version (BE03c 406) finds an active version inside the newest 50
  - rejected: monolithic UI clause: component tests cover the version list, subject mapping and active-version gating, but 'review summary and permitted actions' and the page-level 403/404 split (loader) were not confirmed in one assertion set and no Playwright spec exists for /taxonomies/:taxonomyId (partial candidate)
- clause 0 [high] `apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermForm.refusals.test.tsx` :: CmsTaxonomyTermForm: a refused term action (FE03 :887) links a refusal for a vocabulary with no active version to the governed review
  - rejected: monolithic UI clause: component tests cover the version list, subject mapping and active-version gating, but 'review summary and permitted actions' and the page-level 403/404 split (loader) were not confirmed in one assertion set and no Playwright spec exists for /taxonomies/:taxonomyId (partial candidate)

## P2-S12-AC-183

- clause 0 [high] `tests/contracts/phase-02-slice-12-taxonomy-version-openapi.test.ts` :: Slice 12 taxonomy registry rows and generated OpenAPI (CMS-03C-16, CMS-03C-17 and the vocabulary reads) [P2-S12-AC-183] cmsTaxonomyTermsRead registers GET /api/v1/cms/taxonomies/{taxonomyId}/terms with its auth, step-up,…
  - rejected: monolithic clause ending 'ordered by the signed keyset': the contract, registry row and Worker order check prove the shapes and the tie-break, but the signed keyset cursor is RPC/pgTAP
- clause 0 [high] `packages/contracts/src/cms-composition/taxonomy-term-list.test.ts` :: cmsTaxonomyTermsRead contract [P2-S12-AC-183] returns the eight-member term item with at most 64 labels and 64 aliases
  - rejected: monolithic clause ending 'ordered by the signed keyset': the contract, registry row and Worker order check prove the shapes and the tie-break, but the signed keyset cursor is RPC/pgTAP
- clause 0 [high] `packages/contracts/src/cms-composition/taxonomy-term-list.test.ts` :: cmsTaxonomyTermsRead contract [P2-S12-AC-183] bounds a page at 50 items with an opaque cursor of at most 512, a page version and 256 KiB
  - rejected: monolithic clause ending 'ordered by the signed keyset': the contract, registry row and Worker order check prove the shapes and the tie-break, but the signed keyset cursor is RPC/pgTAP
- clause 0 [high] `apps/worker/src/cms-composition/taxonomy-terms-read.test.ts` :: cmsTaxonomyTermsRead keyset order tie-break (termKey, then termId) accepts equal keys in ascending term id order and refuses descending
  - rejected: monolithic clause ending 'ordered by the signed keyset': the contract, registry row and Worker order check prove the shapes and the tie-break, but the signed keyset cursor is RPC/pgTAP
- clause 0 [medium] `apps/web/src/pages/api/v1/cms/taxonomies/taxonomies-routes.test.ts` :: vocabulary routes sit at the BE03c registry paths has exactly the five routes
  - rejected: monolithic clause ending 'ordered by the signed keyset': the contract, registry row and Worker order check prove the shapes and the tie-break, but the signed keyset cursor is RPC/pgTAP

## P2-S12-AC-184

- clause 0 [high] `packages/contracts/src/cms-composition/taxonomy-term-list.test.ts` :: cmsTaxonomyTermsRead contract [P2-S12-AC-184] takes the vocabulary path with an optional lifecycle, cursor and a limit defaulting to 25
  - rejected: monolithic clause naming a signed context-bound cursor: contract, route and the 256 KiB witness (262145 -> 502) prove the grammar, the bounds and the response bound, but cursor signing/binding is RPC/pgTAP
- clause 0 [high] `packages/contracts/src/cms-composition/taxonomy-term-list.test.ts` :: cmsTaxonomyTermsRead contract [P2-S12-AC-184] bounds the limit 1 to 50, the cursor at 512 and closes lifecycle and every other key
  - rejected: monolithic clause naming a signed context-bound cursor: contract, route and the 256 KiB witness (262145 -> 502) prove the grammar, the bounds and the response bound, but cursor signing/binding is RPC/pgTAP
- clause 0 [high] `apps/worker/src/cms-composition/taxonomy-terms-read.test.ts` :: cmsTaxonomyTermsRead route refuses a malformed vocabulary id and any request that carries a body or write header
  - rejected: monolithic clause naming a signed context-bound cursor: contract, route and the 256 KiB witness (262145 -> 502) prove the grammar, the bounds and the response bound, but cursor signing/binding is RPC/pgTAP
- clause 0 [high] `apps/worker/src/cms-composition/taxonomy-terms-read.test.ts` :: cmsTaxonomyTermsRead route accepts a 512-character cursor and limit 50
  - rejected: monolithic clause naming a signed context-bound cursor: contract, route and the 256 KiB witness (262145 -> 502) prove the grammar, the bounds and the response bound, but cursor signing/binding is RPC/pgTAP
- clause 0 [high] `apps/worker/src/cms-composition-production-taxonomy-reads.test.ts` :: cmsTaxonomyTermsRead production port: platform_api.cms_list_taxonomy_terms (BE03c 167, 1447, 1480) bounds the actual private RPC witness at 262145 bytes whatever the option says
  - rejected: monolithic clause naming a signed context-bound cursor: contract, route and the 256 KiB witness (262145 -> 502) prove the grammar, the bounds and the response bound, but cursor signing/binding is RPC/pgTAP

## P2-S12-AC-185

- clause 0 [high] `apps/worker/src/cms-composition/taxonomy-terms-read.test.ts` :: cmsTaxonomyTermsRead route a caller without cms.taxonomy_curator is 403 capability_missing and consumes no quota
  - rejected: monolithic clause: Worker 403 for a caller without the curator capability; the owner scope, the concealed 404, merged-term successorId listing and the no-owner-field rule are RPC/pgTAP and shape tests

## P2-S12-AC-186

- clause 0 [high] `apps/worker/src/cms-composition/taxonomy-terms-read.test.ts` :: cmsTaxonomyTermsRead route charges the user then the party bucket of the terms read class
  - rejected: monolithic clause naming the Tier 1 p95 target (no benchmark) and a signed cursor bound to the query/acting context (RPC)
- clause 0 [high] `apps/worker/src/cms-composition/taxonomy-terms-read.test.ts` :: cmsTaxonomyTermsRead route serves the page with a quoted page-version ETag, no-store and the CORS echo
  - rejected: monolithic clause naming the Tier 1 p95 target (no benchmark) and a signed cursor bound to the query/acting context (RPC)

## P2-S12-AC-187

- clause 0 [high] `apps/worker/src/cms-composition/taxonomy-terms-read.test.ts` :: cmsTaxonomyTermsRead route relays the port refusal 503 as DEPENDENCY_UNAVAILABLE
  - rejected: monolithic clause: Worker relays stubbed port refusals and the web loader restarts a stale cursor; the 400/409 cursor fault classes and 'no audit or outbox effect' are RPC/pgTAP
- clause 0 [high] `apps/worker/src/cms-composition/taxonomy-terms-read.test.ts` :: cmsTaxonomyTermsRead route relays the quota refusal with its headers and never reaches the port
  - rejected: monolithic clause: Worker relays stubbed port refusals and the web loader restarts a stale cursor; the 400/409 cursor fault classes and 'no audit or outbox effect' are RPC/pgTAP
- clause 0 [medium] `packages/contracts/src/cms-composition/refusals-operations.test.ts` :: BE03c Slice 12 typed refusals per operation [P2-S12-AC-187] cmsTaxonomyTermsRead may publish exactly the typed refusals the BE03c matrices name, every one in the closed set
  - rejected: monolithic clause: Worker relays stubbed port refusals and the web loader restarts a stale cursor; the 400/409 cursor fault classes and 'no audit or outbox effect' are RPC/pgTAP
- clause 0 [high] `apps/web/src/components/cms-taxonomy-pages/load-taxonomy-page.test.ts` :: loadTaxonomyPage: a saved vocabulary restarts a stale cursor from the first page (409)
  - rejected: monolithic clause: Worker relays stubbed port refusals and the web loader restarts a stale cursor; the 400/409 cursor fault classes and 'no audit or outbox effect' are RPC/pgTAP

## P2-S12-AC-188

- clause 0 [high] `apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermForm.test.tsx` :: CmsTaxonomyTermForm: the term list lists every term with labels, aliases, lifecycle and the survivor redirect
  - rejected: monolithic UI clause: component tests cover the term list, URL cursor, survivor redirect, canonical-overlap copy and the review link, but the clause's verification half (term keyset order, cursor binding) is database-level and no Playwright spec exists (partial candidate)
- clause 0 [high] `apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermForm.test.tsx` :: CmsTaxonomyTermForm: the term list keeps the filter and the cursor in the URL: a GET filter form and pager links
  - rejected: monolithic UI clause: component tests cover the term list, URL cursor, survivor redirect, canonical-overlap copy and the review link, but the clause's verification half (term keyset order, cursor binding) is database-level and no Playwright spec exists (partial candidate)
- clause 0 [high] `apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermForm.refusals.test.tsx` :: CmsTaxonomyTermForm: a refused term action (FE03 :887) shows a canonical overlap with its domain and the canonical id as copyable text, never a link
  - rejected: monolithic UI clause: component tests cover the term list, URL cursor, survivor redirect, canonical-overlap copy and the review link, but the clause's verification half (term keyset order, cursor binding) is database-level and no Playwright spec exists (partial candidate)
- clause 0 [high] `apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermForm.refusals.test.tsx` :: CmsTaxonomyTermForm: a refused term action (FE03 :887) links a refusal for a vocabulary with no active version to the governed review
  - rejected: monolithic UI clause: component tests cover the term list, URL cursor, survivor redirect, canonical-overlap copy and the review link, but the clause's verification half (term keyset order, cursor binding) is database-level and no Playwright spec exists (partial candidate)
- clause 0 [high] `apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermForm.actions.test.tsx` :: CmsTaxonomyTermForm: merge requires a survivor, confirms the permanent redirect and shows the survivor redirect
  - rejected: monolithic UI clause: component tests cover the term list, URL cursor, survivor redirect, canonical-overlap copy and the review link, but the clause's verification half (term keyset order, cursor binding) is database-level and no Playwright spec exists (partial candidate)
- clause 0 [low] `apps/web/src/components/cms-taxonomy-pages/taxonomy-filter-roundtrip.test.tsx` :: the term filter form read back by the page loader still refuses a lifecycle that is not one of the three
  - rejected: monolithic UI clause: component tests cover the term list, URL cursor, survivor redirect, canonical-overlap copy and the review link, but the clause's verification half (term keyset order, cursor binding) is database-level and no Playwright spec exists (partial candidate)

## P2-S12-AC-189

- clause 0 [high] `packages/contracts/src/cms-composition/key-grammar.test.ts` :: BE03c key grammar (E13, E14, lineage ids) [P2-S12-AC-189] reserves exactly the template and pattern keys that collide with fixed routes
  - rejected: monolithic clause requiring BOTH the contract schema and a SQL CHECK on the two tables; the contract, route and real-stack cases are Vitest-provable (partial candidates), but the SQL CHECK half is pgTAP
- clause 0 [high] `packages/contracts/src/cms-composition/template-keys.test.ts` :: CMS-03C-01 template keys, audience and lineage (E13, E4) [P2-S12-AC-189] refuses a reserved templateKey at /templateKey with the key_reserved reason
  - rejected: monolithic clause requiring BOTH the contract schema and a SQL CHECK on the two tables; the contract, route and real-stack cases are Vitest-provable (partial candidates), but the SQL CHECK half is pgTAP
- clause 0 [high] `packages/contracts/src/cms-composition/pattern-version.test.ts` :: CMS-03C-12 pattern version request [P2-S12-AC-189] refuses a reserved patternKey at /patternKey with key_reserved
  - rejected: monolithic clause requiring BOTH the contract schema and a SQL CHECK on the two tables; the contract, route and real-stack cases are Vitest-provable (partial candidates), but the SQL CHECK half is pgTAP
- clause 0 [high] `tests/postgrest/phase-02-slice-12-template-version.apispec.ts` :: CMS-03C-01 define a template version through the real stack [P2-S12-AC-005] [P2-S12-AC-189] a reserved key is a 422 whose reasonCode and pointer name /templateKey, and writes nothing
  - rejected: monolithic clause requiring BOTH the contract schema and a SQL CHECK on the two tables; the contract, route and real-stack cases are Vitest-provable (partial candidates), but the SQL CHECK half is pgTAP
- clause 0 [high] `tests/postgrest/phase-02-slice-12-template-reads.apispec.ts` :: cmsTemplateLatestRead through the real stack [P2-S12-AC-166] a malformed key and the reserved keys are 400 and never reach the database
  - rejected: monolithic clause requiring BOTH the contract schema and a SQL CHECK on the two tables; the contract, route and real-stack cases are Vitest-provable (partial candidates), but the SQL CHECK half is pgTAP
- clause 0 [medium] `apps/web/src/server/cms-pattern-platform-latest.test.ts` :: cmsPatternLatestRead proxy: admission (nothing reaches the Worker) refuses the reserved key context
  - rejected: monolithic clause requiring BOTH the contract schema and a SQL CHECK on the two tables; the contract, route and real-stack cases are Vitest-provable (partial candidates), but the SQL CHECK half is pgTAP

## P2-S12-AC-190

- clause 0 [high] `tests/postgrest/phase-02-slice-12-template-version.apispec.ts` :: CMS-03C-01 per-owner keys and concealment through the real stack [P2-S12-AC-022] [P2-S12-AC-190] a second owner defines the key another owner holds without a conflict, in its own lineage
  - rejected: monolithic clause about forward migrations replacing global uniqueness with per-owner uniqueness for templates, patterns and taxonomies; the real-stack case covers templates only and the migration witness checks DDL text; pgTAP is the proof
- clause 0 [medium] `tests/contracts/phase-02-slice-12-fix-template-witness-parity.test.ts` :: template lineage migration witness replays exactly the DDL of 20261013100000_cms_template_per_owner_keys_lineage.sql
  - rejected: monolithic clause about forward migrations replacing global uniqueness with per-owner uniqueness for templates, patterns and taxonomies; the real-stack case covers templates only and the migration witness checks DDL text; pgTAP is the proof

## P2-S12-AC-191

- clause 0 [high] `packages/contracts/src/cms-composition/key-grammar.test.ts` :: BE03c key grammar (E13, E14, lineage ids) [P2-S12-AC-191] types a lineage id as a UUID, the id of the first version row
  - rejected: monolithic clause about lineage columns and a partial unique index (database facts); the contract test only types a lineage id as a UUID

## P2-S12-AC-192

- clause 0 [high] `packages/contracts/src/cms-composition/template-keys.test.ts` :: CMS-03C-01 template keys, audience and lineage (E13, E4) [P2-S12-AC-025] enforces the BE04c audience grammar ^[a-z0-9_-]{1,48}$ as submitted, never trimmed
  - rejected: monolithic clause requiring the grammar in the contracts schema AND in a SQL CHECK; contract, route and real-stack cases prove the refusal at /audience (partial candidates), the SQL CHECK half is pgTAP
- clause 0 [high] `apps/worker/src/cms-composition/phase-02-slice-12-template-key-audience.test.ts` :: E4 audience grammar at the route refuses an audience of a trailing newline with 422 at /audience, before the port
  - rejected: monolithic clause requiring the grammar in the contracts schema AND in a SQL CHECK; contract, route and real-stack cases prove the refusal at /audience (partial candidates), the SQL CHECK half is pgTAP
- clause 0 [high] `tests/postgrest/phase-02-slice-12-template-version.apispec.ts` :: CMS-03C-01 define a template version through the real stack [P2-S12-AC-005] [P2-S12-AC-025] [P2-S12-AC-192] an audience outside ^[a-z0-9_-]{1,48}$ is a 422 at /audience and writes nothing
  - rejected: monolithic clause requiring the grammar in the contracts schema AND in a SQL CHECK; contract, route and real-stack cases prove the refusal at /audience (partial candidates), the SQL CHECK half is pgTAP

## P2-S12-AC-193

- clause 1 [high] `apps/worker/src/cms-composition/block-registry-digest.test.ts` :: BE03c server-authoritative block registry digest hashes only reachable safe tuples in UTF-8 key and numeric version order
  - rejected: tests exercise the TypeScript reference module block-registry-digest.ts which has no production caller; the server-authoritative digest is the SQL function (pgTAP), so they do not prove 'the server' sorting or recompute
- clause 1 [high] `apps/worker/src/cms-composition/block-registry-digest.test.ts` :: BE03c server-authoritative block registry digest orders two versions of one key numerically and ignores unrelated safe records
  - rejected: tests exercise the TypeScript reference module block-registry-digest.ts which has no production caller; the server-authoritative digest is the SQL function (pgTAP), so they do not prove 'the server' sorting or recompute
- clause 3 [high] `apps/worker/src/cms-composition/block-registry-digest.test.ts` :: BE03c server-authoritative block registry digest compares a caller digest only as an expectation
  - rejected: tests exercise the TypeScript reference module block-registry-digest.ts which has no production caller; the server-authoritative digest is the SQL function (pgTAP), so they do not prove 'the server' sorting or recompute

## P2-S12-AC-194

- clause 0 [high] `apps/worker/src/cms-composition/block-registry-digest.test.ts` :: BE03c server-authoritative block registry digest rejects missing, withdrawn, duplicate, or incompatible reachable blocks
  - rejected: tests exercise the TypeScript reference digest module (no production caller); the registry consumption by the SQL template path, never-mutates and lifecycle-event consumption are pgTAP or unbuilt
- clause 0 [high] `apps/worker/src/cms-composition/block-registry-digest.test.ts` :: BE03c server-authoritative block registry digest rejects malformed references and unsafe registry projections
  - rejected: tests exercise the TypeScript reference digest module (no production caller); the registry consumption by the SQL template path, never-mutates and lifecycle-event consumption are pgTAP or unbuilt
- clause 0 [high] `apps/worker/src/cms-composition/block-registry-digest.test.ts` :: BE03c server-authoritative block registry digest fails closed when runtime inputs omit record arrays or compatibility policy
  - rejected: tests exercise the TypeScript reference digest module (no production caller); the registry consumption by the SQL template path, never-mutates and lifecycle-event consumption are pgTAP or unbuilt

## P2-S12-AC-205

- clause 0 [medium] `apps/worker/src/cms-composition/governed-activation.test.ts` :: CMS-03C-09 activate (BE03c row 171, steps 1-6) > answers 200 with the strict resource, the review ETag and the review Location
  - rejected: candidate identities use a ' > ' title joiner that is not the run identity; and the Worker cases only prove the request members and the 200 resource (stub), while the activation transaction and race are RPC/pgTAP
- clause 0 [medium] `apps/worker/src/cms-composition/governed-activation.test.ts` :: CMS-03C-09 activate (BE03c row 171, steps 1-6) > calls cms_activate_governed_subject with exactly the members the SQL producer accepts
  - rejected: candidate identities use a ' > ' title joiner that is not the run identity; and the Worker cases only prove the request members and the 200 resource (stub), while the activation transaction and race are RPC/pgTAP

## P2-S12-AC-206

- clause 0 [high] `apps/worker/src/cms-composition/governed-activation.test.ts` :: CMS-03C-09 schedule (202, no event) > answers 202 with the unchanged review version as ETag and the review Location
  - rejected: monolithic RPC clause (Time authority resolution, preflight, scheduled row, schedule_exists, no event): the Worker cases only prove the 202 answer shape and that the instant is verified over the injected clock; candidate identities use a ' > ' joiner that is not the run identity
- clause 0 [high] `apps/worker/src/cms-composition/governed-activation-time.test.ts` :: CMS-03C-09 schedule: the Worker Time authority (BE03b E8, BE03c 1326 step 6) > verifies the instant over the injected clock and the pinned snapshot, then forwards it unchanged
  - rejected: monolithic RPC clause (Time authority resolution, preflight, scheduled row, schedule_exists, no event): the Worker cases only prove the 202 answer shape and that the instant is verified over the injected clock; candidate identities use a ' > ' joiner that is not the run identity

## P2-S12-AC-207

- clause 0 [high] `apps/worker/src/cms-composition/governed-activation.test.ts` :: CMS-03C-09 retire (DEC-190: active subject only, review version advances by one) > answers a retirement of a non-active subject as the closed 409 subject_not_retirable
  - rejected: (clause 0) activation database transaction: the Worker cases prove a stubbed subject_not_retirable mapping and recent MFA before any RPC; the retire rules (DEC-190), event type and owner capability are RPC/pgTAP; candidate identities use a ' > ' joiner
- clause 0 [high] `apps/worker/src/cms-composition/governed-activation.test.ts` :: CMS-03C-09 retire (DEC-190: active subject only, review version advances by one) > still demands recent MFA for retire before any RPC
  - rejected: (clause 0) activation database transaction: the Worker cases prove a stubbed subject_not_retirable mapping and recent MFA before any RPC; the retire rules (DEC-190), event type and owner capability are RPC/pgTAP; candidate identities use a ' > ' joiner

## P2-S12-AC-214

- clause 0 [low] `apps/worker/src/cms-composition/pattern-update-dec193.test.ts` :: DEC-193 Worker update answer binding > [DEC193-WU-01] accepts %s with its prior positive provenance pin
  - rejected: RPC/pgTAP resolution semantics (DEC-193); the Worker answer-binding test is low confidence and the identity is a template

## P2-S12-AC-216

- clause 0 [medium] `apps/worker/src/cms-composition/pattern-instance-reasons.test.ts` :: CMS-03C-02 route typed Slice 12 refusals > publishes %s as %i %s with exactly its reasonCode
  - rejected: RPC rule (current draft revision, readable, lineage in owner scope) decided by cms_insert_pattern_instance; the Worker typed-refusal relay is not the determination

## P2-S12-AC-217

- clause 0 [medium] `apps/worker/src/cms-composition/pattern-instance-reasons.test.ts` :: CMS-03C-02 route typed Slice 12 refusals > publishes %s as %i %s with exactly its reasonCode
  - rejected: RPC rule (active version, compatibleTypeIds) decided by cms_insert_pattern_instance; the Worker relays a stubbed typed refusal

## P2-S12-AC-218

- clause 2 [high] `apps/worker/src/cms-composition/pattern-placement-http.test.ts` :: CMS-03C-02 pattern placement at the HTTP app.request boundary > [P2-S12-AC-010] answers 201 with the placement list and the forwarded entry ETag
  - rejected: (clause 2) PatternPlacementResource shape and the 201 answer only; the append-only rows, positions, expansion and all-or-nothing are RPC/pgTAP; candidate identities use a ' > ' joiner
- clause 2 [high] `packages/contracts/src/cms-composition/pattern-instance.test.ts` :: PatternPlacementResource (CMS-03C-02 201, DEC-175, DEC-181) > [P2-S12-AC-010] answers an items list of one or more rows, at most 512 after expansion
  - rejected: (clause 2) PatternPlacementResource shape and the 201 answer only; the append-only rows, positions, expansion and all-or-nothing are RPC/pgTAP; candidate identities use a ' > ' joiner
- clause 3 [high] `packages/contracts/src/cms-composition/pattern-instance.test.ts` :: PatternPlacementResource (CMS-03C-02 201, DEC-175, DEC-181) > [P2-S12-AC-218] places every row on one revision, one pinned pattern version and one link mode
  - rejected: (clause 2) PatternPlacementResource shape and the 201 answer only; the append-only rows, positions, expansion and all-or-nothing are RPC/pgTAP; candidate identities use a ' > ' joiner
- clause 4 [high] `packages/contracts/src/cms-composition/pattern-instance.test.ts` :: CMS-03C-02 pattern-instance wire contract > [P2-S12-AC-028] accepts only normalized node paths as override keys and reports any other key at /overrides
  - rejected: (clause 2) PatternPlacementResource shape and the 201 answer only; the append-only rows, positions, expansion and all-or-nothing are RPC/pgTAP; candidate identities use a ' > ' joiner
- clause 7 [high] `apps/worker/src/cms-composition/pattern-placement-http.test.ts` :: CMS-03C-02 selected-root response binding (DEC-193) > [P2-S12-AC-218] forwards the selected set without reordering sparse successor rows
  - rejected: (clause 2) PatternPlacementResource shape and the 201 answer only; the append-only rows, positions, expansion and all-or-nothing are RPC/pgTAP; candidate identities use a ' > ' joiner

## P2-S12-AC-222

- clause 0 [high] `packages/contracts/src/cms-composition/refusals.test.ts` :: BE03c Slice 12 typed refusals (closed reason-token sets) > [P2-S12-AC-222] carries the canonical domain and canonical id on a canonical_overlap refusal
  - rejected: contract carries the refusal members (domain, canonicalId); the overlap check itself is RPC/pgTAP

## P2-S12-AC-223

- clause 0 [high] `packages/contracts/src/cms-composition/refusals.test.ts` :: BE03c Slice 12 typed refusals (closed reason-token sets) > [P2-S12-AC-223] carries the canonical domain on a canonical_source_unavailable refusal
  - rejected: contract carries the refusal member (domain); unbuilt-provider refusal at activation/actions and provider-fault 503 are RPC/pgTAP

## P2-S12-AC-227

- clause 0 [medium] `apps/web/src/components/cms-related-content/CmsRelatedContentForm.refusals.test.tsx` :: an ineligible target (422 related_target_ineligible) > shows the identical message for a pin and an exclusion, so the cause cannot be inferred
  - rejected: RPC rule (pin/exclusion eligibility, uniform 422, no existence oracle); the web form copy test shows an identical message only

## P2-S12-AC-229

- clause 0 [high] `packages/contracts/src/cms-composition/related-public-target.test.ts` :: CMS-03C-21 related public targets (D11, OD-5) > [P2-S12-AC-229] holds the code-owned rule registry to shared-terms and same-type-recent at version 1
  - rejected: monolithic clause whose substance includes platform_private.cms_related_rule_valid and the 422 derived_rule_unknown determination (RPC/pgTAP); the contract tests prove the code-owned registry values and null resolution of unknown keys (partial candidates, used under AC-037)
- clause 0 [high] `packages/contracts/src/cms-composition/related-public-target.test.ts` :: CMS-03C-21 related public targets (D11, OD-5) > [P2-S12-AC-229] resolves an unknown rule key or version to nothing and never inherits a prototype member
  - rejected: monolithic clause whose substance includes platform_private.cms_related_rule_valid and the 422 derived_rule_unknown determination (RPC/pgTAP); the contract tests prove the code-owned registry values and null resolution of unknown keys (partial candidates, used under AC-037)

## P2-S12-AC-235

- clause 0 [high] `packages/contracts/src/cms-composition/locale-variant-stale.test.ts` :: per-field staleness on the variant resource (DEC-121) > [P2-S12-AC-235] bounds the stale fields at 128 unique UUIDs
  - rejected: per-field staleness is recorded/derived by the RPC (field_source_hashes, staleFieldIds, revalidation); the contract bounds stale ids only

## P2-S12-AC-236

- clause 1 [high] `apps/worker/src/cms-composition/locale-routes-refusals.test.ts` :: CMS-03C-04 locale authoring route > [P2-S12-AC-236] returns locale_limit_reached on the 409 of a 33rd locale variant and nothing else
  - rejected: (clause 1) the 33rd-locale determination is RPC/pgTAP; the Worker route and adapter only carry a stubbed locale_limit_reached 409; candidate identities use a ' > ' joiner
- clause 1 [high] `apps/worker/src/cms-composition-production-locale.test.ts` :: CMS-03C-04 production locale adapter > [P2-S12-AC-236] carries locale_limit_reached on the 33rd-locale conflict and nothing else
  - rejected: (clause 1) the 33rd-locale determination is RPC/pgTAP; the Worker route and adapter only carry a stubbed locale_limit_reached 409; candidate identities use a ' > ' joiner

## P2-S12-AC-237

- clause 0 [high] `packages/contracts/src/cms-editorial/review-recheck.test.ts` :: [P2-S11-AC-113] review recheck source events > [P2-S12-AC-237] admits the locale aggregate envelope of cms.localization.changed.v1 and refuses the former and the dotted aggregate types
  - rejected: contract admits the locale aggregate envelope shape; the outbox identity (UUIDv5 aggregate id, version) is RPC/pgTAP

## P2-S12-AC-239

- clause 0 [medium] `packages/contracts/src/cms-composition/preflight-providers.test.ts` :: Preflight providers registered by Slice 12 (BE03c) > [P2-S12-AC-239] closes the taxonomy provider to its own failure reasons
  - rejected: contract tests prove only the closed reason set and the provider catalog registration; the provider is not built so the assignment_integrity checks have no behaviour test
- clause 0 [medium] `packages/contracts/src/cms-composition/preflight-providers.test.ts` :: Preflight providers registered by Slice 12 (BE03c) > [P2-S12-AC-241] registers exactly the pattern, taxonomy and locale providers, each replacing a reference gate
  - rejected: contract tests prove only the closed reason set and the provider catalog registration; the provider is not built so the assignment_integrity checks have no behaviour test

## P2-S12-AC-240

- clause 0 [high] `packages/contracts/src/cms-composition/locale-resolution.test.ts` :: CMS-03C-20 locale field resolution (DEC-121, DEC-138) > [P2-S12-AC-240] registers the no_fallback_gate provider and its three closed failure reasons
  - not selected: no individual verdict recorded: redundant to the cited tests of the same clause, a neighbour/analogue of the clause, or its criterion was left uncited as monolithic (see the criterion limitation)

## P2-S12-AC-241

- clause 0 [high] `packages/contracts/src/cms-composition/preflight-providers.test.ts` :: Preflight providers registered by Slice 12 (BE03c) > [P2-S12-AC-241] registers exactly the pattern, taxonomy and locale providers, each replacing a reference gate
  - rejected: contract registry/reason-copy tests prove the closed per-category reason sets and the provider catalog; 'each provider is implemented in the deployed preflight evaluation before its registry row' is pgTAP/WIP and the taxonomy provider has no dispatch branch
- clause 0 [high] `packages/contracts/src/cms-composition/preflight-providers.test.ts` :: Preflight providers registered by Slice 12 (BE03c) > [P2-S12-AC-241] gives no two providers a shared reason code
  - rejected: contract registry/reason-copy tests prove the closed per-category reason sets and the provider catalog; 'each provider is implemented in the deployed preflight evaluation before its registry row' is pgTAP/WIP and the taxonomy provider has no dispatch branch
- clause 0 [high] `packages/contracts/src/cms-editorial/preflight.test.ts` :: [P2-S11-AC-093] publication preflight registry (D19) > [P2-S12-AC-241] knows the locale refusal tokens, so a revision blocked by the gate answers 422 preflight_failed and not a scrubbed 500
  - rejected: contract registry/reason-copy tests prove the closed per-category reason sets and the provider catalog; 'each provider is implemented in the deployed preflight evaluation before its registry row' is pgTAP/WIP and the taxonomy provider has no dispatch branch
- clause 0 [high] `tests/contracts/phase-02-slice-11-sql-parity.test.ts` :: [P2-S11-AC-093] the SQL preflight registry seed equals CMS_PREFLIGHT_REGISTRY > [P2-S12-AC-241] replaces the seeded reference gate only for categories whose provider a later slice registered
  - rejected: contract registry/reason-copy tests prove the closed per-category reason sets and the provider catalog; 'each provider is implemented in the deployed preflight evaluation before its registry row' is pgTAP/WIP and the taxonomy provider has no dispatch branch

## P2-S12-AC-248

- clause 0 [low] `packages/contracts/src/cms-editorial/review-recheck.test.ts` :: [P2-S11-AC-113] review recheck source events > pins the aggregate of the events whose producers exist and accepts any registry key for the Slice 12 events
  - rejected: low-confidence: the recheck-source contract admits any registry key for Slice 12 events; no relay-claimability migration or test exists for the template/pattern/taxonomy aggregate types

## P2-S12-AC-259

- clause 0 [medium] `tests/contracts/phase-02-slice-12-taxonomy-version-openapi.test.ts` :: Slice 12 taxonomy registry rows and generated OpenAPI (CMS-03C-16, CMS-03C-17 and the vocabulary reads) > [P2-S12-AC-124] documents the taxonomy version body with bounded allowlists and the six canonical domains
  - rejected: OpenAPI body bound for the six canonical domains; the persistence CHECK on cms_taxonomy_versions.canonical_overlap_domains (at most 6 unique members) is pgTAP

## P2-S12-AC-263

- clause 0 [high] `apps/worker/src/cms-composition/governed-activation-metrics.test.ts` :: CMS-03C-09 emits cms_governed_activation_total with the spec labels > counts a verified schedule acceptance (202) as action schedule
  - rejected: observability lane (concurrently adding metric/alert modules and tests); the activation-metrics and sweep cases cover two of the twelve metrics and are not cited this pass
- clause 0 [high] `apps/worker/src/cms-composition/governed-activation-metrics.test.ts` :: CMS-03C-09 emits cms_governed_activation_total with the spec labels > keeps every label closed: no key, user, party or review id reaches the metric
  - rejected: observability lane (concurrently adding metric/alert modules and tests); the activation-metrics and sweep cases cover two of the twelve metrics and are not cited this pass
- clause 0 [high] `apps/worker/src/cms-governed-activation-sweep.test.ts` :: executing claims > counts a blocked schedule with its closed reason and only then
  - rejected: observability lane (concurrently adding metric/alert modules and tests); the activation-metrics and sweep cases cover two of the twelve metrics and are not cited this pass

## P2-S12-AC-265

- clause 0 [high] `tests/e2e/phase-02-slice-12-template-edit.spec.ts` :: [P2-S12-AC-265] a malformed template key is a no-store, accessible 400 without disclosure
  - rejected: monolithic page clause: the Playwright edit spec and the route/loader tests prove the malformed-key 400, reserved keys and the redirect, but the disclosure-safe 404, the owner-scope 403, the CmsGovernedReviewPanel and 'Back restores the form' are not all asserted at the page level (page route tests read the Astro source as text; the in-memory real-route specs); candidate identities use a ' > ' joiner or an unexpanded ${reserved} title
- clause 0 [high] `tests/e2e/phase-02-slice-12-template-edit.spec.ts` :: [P2-S12-AC-265] [P2-S12-AC-189] the reserved key ${reserved} never resolves as a template key
  - rejected: monolithic page clause: the Playwright edit spec and the route/loader tests prove the malformed-key 400, reserved keys and the redirect, but the disclosure-safe 404, the owner-scope 403, the CmsGovernedReviewPanel and 'Back restores the form' are not all asserted at the page level (page route tests read the Astro source as text; the in-memory real-route specs); candidate identities use a ' > ' joiner or an unexpanded ${reserved} title
- clause 0 [high] `apps/web/src/pages/app/cms-content-modeling/templates/template-designer-route.test.ts` :: CMS-11 protected template designer page > redirects an expired session and never turns denial/degradation into a form
  - rejected: monolithic page clause: the Playwright edit spec and the route/loader tests prove the malformed-key 400, reserved keys and the redirect, but the disclosure-safe 404, the owner-scope 403, the CmsGovernedReviewPanel and 'Back restores the form' are not all asserted at the page level (page route tests read the Astro source as text; the in-memory real-route specs); candidate identities use a ' > ' joiner or an unexpanded ${reserved} title
- clause 0 [high] `apps/web/src/pages/app/cms-content-modeling/templates/template-designer-route.test.ts` :: CMS-11 protected template successor page > loads canonical detail and selectors before hydrating the edit form
  - rejected: monolithic page clause: the Playwright edit spec and the route/loader tests prove the malformed-key 400, reserved keys and the redirect, but the disclosure-safe 404, the owner-scope 403, the CmsGovernedReviewPanel and 'Back restores the form' are not all asserted at the page level (page route tests read the Astro source as text; the in-memory real-route specs); candidate identities use a ' > ' joiner or an unexpanded ${reserved} title
- clause 0 [medium] `apps/web/src/pages/app/cms-content-modeling/templates/template-designer-route.test.ts` :: CMS-11 protected template designer page > renders on demand with no-store headers and a navigable focus target
  - rejected: monolithic page clause: the Playwright edit spec and the route/loader tests prove the malformed-key 400, reserved keys and the redirect, but the disclosure-safe 404, the owner-scope 403, the CmsGovernedReviewPanel and 'Back restores the form' are not all asserted at the page level (page route tests read the Astro source as text; the in-memory real-route specs); candidate identities use a ' > ' joiner or an unexpanded ${reserved} title
- clause 0 [medium] `apps/web/src/components/cms-governed-review/CmsGovernedTemplatePanel.test.tsx` :: CmsGovernedTemplatePanel > submits the template version it was served and re-reads the latest template afterwards
  - rejected: monolithic page clause: the Playwright edit spec and the route/loader tests prove the malformed-key 400, reserved keys and the redirect, but the disclosure-safe 404, the owner-scope 403, the CmsGovernedReviewPanel and 'Back restores the form' are not all asserted at the page level (page route tests read the Astro source as text; the in-memory real-route specs); candidate identities use a ' > ' joiner or an unexpanded ${reserved} title

## P2-S12-AC-266

- clause 0 [high] `apps/web/src/components/cms-pattern-designer/load-pattern-designer-page.test.ts` :: loadPatternDesignerPage: a saved pattern > answers the key %j with a 400 before any read
  - rejected: monolithic page clause: loader and component tests cover 400 reserved keys, the redirect, the 404 and the preimage (partial candidates), but the 403 page state, the bounded CmsGovernedReviewPanel on the page and the 'protected Astro SSR' route claim have no page-level assertion and no Playwright spec exists; candidate titles are unexpanded templates
- clause 0 [high] `apps/web/src/components/cms-pattern-designer/load-pattern-designer-page.test.ts` :: loadPatternDesignerPage: a saved pattern > shows the disclosure-safe 404 for a concealed or absent key
  - rejected: monolithic page clause: loader and component tests cover 400 reserved keys, the redirect, the 404 and the preimage (partial candidates), but the 403 page state, the bounded CmsGovernedReviewPanel on the page and the 'protected Astro SSR' route claim have no page-level assertion and no Playwright spec exists; candidate titles are unexpanded templates
- clause 0 [high] `apps/web/src/components/cms-pattern-designer/load-pattern-designer-page.test.ts` :: loadPatternDesignerPage: a new pattern > redirects an expired session to sign-in and back to the new-pattern page
  - rejected: monolithic page clause: loader and component tests cover 400 reserved keys, the redirect, the 404 and the preimage (partial candidates), but the 403 page state, the bounded CmsGovernedReviewPanel on the page and the 'protected Astro SSR' route claim have no page-level assertion and no Playwright spec exists; candidate titles are unexpanded templates
- clause 0 [high] `apps/web/src/components/cms-pattern-designer/load-pattern-designer-page.test.ts` :: loadPatternDesignerPage: a new pattern > shows one fixed notice for a %i
  - rejected: monolithic page clause: loader and component tests cover 400 reserved keys, the redirect, the 404 and the preimage (partial candidates), but the 403 page state, the bounded CmsGovernedReviewPanel on the page and the 'protected Astro SSR' route claim have no page-level assertion and no Playwright spec exists; candidate titles are unexpanded templates
- clause 0 [high] `apps/web/src/components/cms-pattern-designer/load-pattern-designer-page.test.ts` :: loadPatternDesignerPage: a saved pattern > serves the latest version as the edit preimage and the panel facts
  - rejected: monolithic page clause: loader and component tests cover 400 reserved keys, the redirect, the 404 and the preimage (partial candidates), but the 403 page state, the bounded CmsGovernedReviewPanel on the page and the 'protected Astro SSR' route claim have no page-level assertion and no Playwright spec exists; candidate titles are unexpanded templates
- clause 0 [medium] `apps/web/src/pages/app/cms-content-modeling/patterns/pattern-pages.test.ts` :: %s > renders on demand with no-store headers and answers only GET
  - rejected: monolithic page clause: loader and component tests cover 400 reserved keys, the redirect, the 404 and the preimage (partial candidates), but the 403 page state, the bounded CmsGovernedReviewPanel on the page and the 'protected Astro SSR' route claim have no page-level assertion and no Playwright spec exists; candidate titles are unexpanded templates

## P2-S12-AC-267

- clause 0 [high] `apps/web/src/components/cms-taxonomy-pages/load-taxonomy-page.test.ts` :: loadTaxonomyPage: a saved vocabulary > serves the newest version as the edit preimage, the history, the active version and the first term page
  - rejected: monolithic page clause: loader tests cover the preimage, history, active-version gating, 400 ids and the URL state (partial candidates), but the 403 state, the 404 and the bounded governed review panel are not confirmed at the page level and no Playwright spec exists; candidate titles are unexpanded templates
- clause 0 [high] `apps/web/src/components/cms-taxonomy-pages/load-taxonomy-page.test.ts` :: loadTaxonomyPage: a saved vocabulary > offers term actions against no version when none is active
  - rejected: monolithic page clause: loader tests cover the preimage, history, active-version gating, 400 ids and the URL state (partial candidates), but the 403 state, the 404 and the bounded governed review panel are not confirmed at the page level and no Playwright spec exists; candidate titles are unexpanded templates
- clause 0 [high] `apps/web/src/components/cms-taxonomy-pages/load-taxonomy-page.test.ts` :: loadTaxonomyPage: a saved vocabulary > answers the malformed or reserved id %s with 400 before any read
  - rejected: monolithic page clause: loader tests cover the preimage, history, active-version gating, 400 ids and the URL state (partial candidates), but the 403 state, the 404 and the bounded governed review panel are not confirmed at the page level and no Playwright spec exists; candidate titles are unexpanded templates
- clause 0 [high] `apps/web/src/components/cms-taxonomy-pages/load-taxonomy-page.test.ts` :: loadTaxonomyPage: a saved vocabulary > forwards the URL state of the term list and never any other member of the page URL
  - rejected: monolithic page clause: loader tests cover the preimage, history, active-version gating, 400 ids and the URL state (partial candidates), but the 403 state, the 404 and the bounded governed review panel are not confirmed at the page level and no Playwright spec exists; candidate titles are unexpanded templates
- clause 0 [high] `apps/web/src/components/cms-taxonomy-pages/load-taxonomy-page.test.ts` :: loadTaxonomyPage: a saved vocabulary > shows one fixed notice for a versions %i
  - rejected: monolithic page clause: loader tests cover the preimage, history, active-version gating, 400 ids and the URL state (partial candidates), but the 403 state, the 404 and the bounded governed review panel are not confirmed at the page level and no Playwright spec exists; candidate titles are unexpanded templates
- clause 0 [high] `apps/web/src/components/cms-taxonomy-pages/load-taxonomy-page.new.test.ts` :: loadTaxonomyPage: a new vocabulary > redirects an expired session to sign-in and back to the new-vocabulary page
  - rejected: monolithic page clause: loader tests cover the preimage, history, active-version gating, 400 ids and the URL state (partial candidates), but the 403 state, the 404 and the bounded governed review panel are not confirmed at the page level and no Playwright spec exists; candidate titles are unexpanded templates
- clause 0 [high] `apps/web/src/pages/app/cms-content-modeling/taxonomies/taxonomy-pages.test.ts` :: the saved-vocabulary page > mounts the term form only from a verified vocabulary and term page
  - rejected: monolithic page clause: loader tests cover the preimage, history, active-version gating, 400 ids and the URL state (partial candidates), but the 403 state, the 404 and the bounded governed review panel are not confirmed at the page level and no Playwright spec exists; candidate titles are unexpanded templates

## P2-S12-AC-268

- clause 0 [high] `apps/web/src/pages/app/cms-content-modeling/definition-reviews/definition-review-routes.test.tsx` :: CMS-03C-11 protected definition-review queue page, composed > lists the scope as native links with a signed, URL-owned continuation
  - rejected: monolithic page clause across five forms and two pages: component/loader tests cover several halves (partial candidates), but the 403 state, the decision-form-only-with-assignment rule at the page and the activation-owner gating are not asserted together and no Playwright spec exists
- clause 0 [high] `apps/web/src/pages/app/cms-content-modeling/definition-reviews/definition-review-routes.test.tsx` :: CMS-03C-10 protected definition-review detail page, composed > answers a hidden, absent or cross-owner review with one closed 404 state
  - rejected: monolithic page clause across five forms and two pages: component/loader tests cover several halves (partial candidates), but the 403 state, the decision-form-only-with-assignment rule at the page and the activation-owner gating are not asserted together and no Playwright spec exists
- clause 0 [high] `apps/web/src/pages/app/cms-content-modeling/definition-reviews/definition-review-routes.test.tsx` :: CMS-03C-10 protected definition-review detail page, composed > serves the assignment controls to the owner and no person identifier
  - rejected: monolithic page clause across five forms and two pages: component/loader tests cover several halves (partial candidates), but the 403 state, the decision-form-only-with-assignment rule at the page and the activation-owner gating are not asserted together and no Playwright spec exists
- clause 0 [high] `apps/web/src/components/cms-governed-review/load-governed-detail-page.test.ts` :: loadGovernedDetailPage > answers a malformed review id with a 400 before any read
  - rejected: monolithic page clause across five forms and two pages: component/loader tests cover several halves (partial candidates), but the 403 state, the decision-form-only-with-assignment rule at the page and the activation-owner gating are not asserted together and no Playwright spec exists
- clause 0 [high] `apps/web/src/components/cms-governed-review/CmsGovernedActivationForm.test.tsx` :: CmsGovernedActivationForm (CMS-03C-09) controls > offers exactly the permitted actions as unselected radios under a named heading
  - rejected: monolithic page clause across five forms and two pages: component/loader tests cover several halves (partial candidates), but the 403 state, the decision-form-only-with-assignment rule at the page and the activation-owner gating are not asserted together and no Playwright spec exists
- clause 0 [high] `apps/web/src/components/cms-governed-review/CmsGovernedActivationForm.test.tsx` :: CmsGovernedActivationForm (CMS-03C-09) controls > offers only Retire for an active version
  - rejected: monolithic page clause across five forms and two pages: component/loader tests cover several halves (partial candidates), but the 403 state, the decision-form-only-with-assignment rule at the page and the activation-owner gating are not asserted together and no Playwright spec exists
- clause 0 [high] `apps/web/src/components/cms-governed-review/CmsGovernedAssignmentForm.test.tsx` :: CmsGovernedAssignmentForm visibility (CMS-03C-08) > renders only the controls the server permits
  - rejected: monolithic page clause across five forms and two pages: component/loader tests cover several halves (partial candidates), but the 403 state, the decision-form-only-with-assignment rule at the page and the activation-owner gating are not asserted together and no Playwright spec exists
- clause 0 [high] `apps/web/src/components/cms-governed-review/load-governed-queue-page.test.ts` :: loadGovernedQueuePage > returns the verified page with the URL-owned query for the view
  - rejected: monolithic page clause across five forms and two pages: component/loader tests cover several halves (partial candidates), but the 403 state, the decision-form-only-with-assignment rule at the page and the activation-owner gating are not asserted together and no Playwright spec exists

## P2-S12-AC-271

- clause 0 [medium] `apps/web/src/components/cms-governed-review/CmsGovernedDecisionForm.test.tsx` :: CmsGovernedDecisionForm (CMS-03C-07) > routes a step-up shortfall to the verification page with the draft stored and nothing replayed
  - rejected: monolithic seven-state clause: per-island partial coverage only; none asserts the 250 ms skeleton rule and the diff, composition-list and locale-form islands were not covered when classified (re-check after the web-composition lane)
- clause 0 [medium] `apps/web/src/components/cms-governed-review/CmsGovernedDecisionForm.test.tsx` :: CmsGovernedDecisionForm (CMS-03C-07) > renders the separation-of-duties gate, never a step-up route
  - rejected: monolithic seven-state clause: per-island partial coverage only; none asserts the 250 ms skeleton rule and the diff, composition-list and locale-form islands were not covered when classified (re-check after the web-composition lane)
- clause 0 [medium] `apps/web/src/components/cms-governed-review/CmsGovernedDecisionForm.test.tsx` :: CmsGovernedDecisionForm (CMS-03C-07) > keeps the entered text and offers a reconciled retry after a lost answer
  - rejected: monolithic seven-state clause: per-island partial coverage only; none asserts the 250 ms skeleton rule and the diff, composition-list and locale-form islands were not covered when classified (re-check after the web-composition lane)
- clause 0 [medium] `apps/web/src/components/cms-related-content/CmsRelatedContentForm.refusals.test.tsx` :: the other outcomes > renders a rejected %i as a fixed state
  - rejected: monolithic seven-state clause: per-island partial coverage only; none asserts the 250 ms skeleton rule and the diff, composition-list and locale-form islands were not covered when classified (re-check after the web-composition lane)
- clause 0 [low] `apps/web/src/components/cms-governed-review/CmsGovernedActivationForm.test.tsx` :: activation commit > sends the strict body at the review version, refetches, focuses the summary and announces "not published"
  - rejected: monolithic seven-state clause: per-island partial coverage only; none asserts the 250 ms skeleton rule and the diff, composition-list and locale-form islands were not covered when classified (re-check after the web-composition lane)

## P2-S12-AC-272

- clause 0 [high] `tests/contracts/phase-02-slice-12-governed-review-openapi.test.ts` :: Slice 12 governed review registry rows and generated OpenAPI (CMS-03C-06 to CMS-03C-11) > [P2-S12-AC-136] keeps the internal CMS-03C-18 to CMS-03C-21 operations and their records out of the browser inventory and OpenAPI
  - rejected: only the 'no browser route/client type for CMS-03C-18 to -21' half is asserted (inventory tests); no test asserts that reasons, policy basis, diff values, canonical ids and assignment identifiers never enter caches, analytics, Realtime, URLs or logs
- clause 0 [high] `apps/worker/src/cms-composition/locale-routes-refusals.test.ts` :: CMS-03C-04 locale authoring route > [P2-S12-AC-150] keeps the CMS-03C-20 resolver out of the browser route inventory and the locale app
  - rejected: only the 'no browser route/client type for CMS-03C-18 to -21' half is asserted (inventory tests); no test asserts that reasons, policy basis, diff values, canonical ids and assignment identifiers never enter caches, analytics, Realtime, URLs or logs
- clause 0 [high] `apps/worker/src/cms-composition/related-content-no-public-targets-route.test.ts` :: CMS-03C-21 has no browser route (BE03c 190) > answers 404 or 405 for %s %s
  - rejected: only the 'no browser route/client type for CMS-03C-18 to -21' half is asserted (inventory tests); no test asserts that reasons, policy basis, diff values, canonical ids and assignment identifiers never enter caches, analytics, Realtime, URLs or logs

## P2-S12-AC-274

- clause 0 [high] `packages/contracts/src/cms-composition/refusals.test.ts` :: BE03c Slice 12 typed refusals (closed reason-token sets) > [P2-S12-AC-274] lists exactly the BE03c 409 tokens, DEC-186 digest mismatch and FALLBACK_CHAIN_MISMATCH included
  - rejected: monolithic catalog-wide clause across 22 operations: the contract tests (closed 409/422/403 token sets, one status per token, per-operation allowlists, catalog status resolution) are strong partial candidates, but the Worker half (503 never success-shaped, unmapped status -> scrubbed 500 on every operation) is covered per operation by templated suites and is not enumerated here; candidate titles use a ' > ' joiner or unexpanded $name/%s templates
- clause 0 [high] `packages/contracts/src/cms-composition/refusals.test.ts` :: BE03c Slice 12 typed refusals (closed reason-token sets) > [P2-S12-AC-274] lists exactly the BE03c 422 tokens and the 03b time tokens of a scheduled activation
  - rejected: monolithic catalog-wide clause across 22 operations: the contract tests (closed 409/422/403 token sets, one status per token, per-operation allowlists, catalog status resolution) are strong partial candidates, but the Worker half (503 never success-shaped, unmapped status -> scrubbed 500 on every operation) is covered per operation by templated suites and is not enumerated here; candidate titles use a ' > ' joiner or unexpanded $name/%s templates
- clause 0 [high] `packages/contracts/src/cms-composition/refusals.test.ts` :: BE03c Slice 12 typed refusals (closed reason-token sets) > [P2-S12-AC-274] lists each token under exactly one status and keeps it on every operation
  - rejected: monolithic catalog-wide clause across 22 operations: the contract tests (closed 409/422/403 token sets, one status per token, per-operation allowlists, catalog status resolution) are strong partial candidates, but the Worker half (503 never success-shaped, unmapped status -> scrubbed 500 on every operation) is covered per operation by templated suites and is not enumerated here; candidate titles use a ' > ' joiner or unexpanded $name/%s templates
- clause 0 [high] `packages/contracts/src/cms-composition/refusals.test.ts` :: BE03c Slice 12 typed refusals (closed reason-token sets) > [P2-S12-AC-274] lists exactly the 403 tokens capability_missing and separation_of_duties
  - rejected: monolithic catalog-wide clause across 22 operations: the contract tests (closed 409/422/403 token sets, one status per token, per-operation allowlists, catalog status resolution) are strong partial candidates, but the Worker half (503 never success-shaped, unmapped status -> scrubbed 500 on every operation) is covered per operation by templated suites and is not enumerated here; candidate titles use a ' > ' joiner or unexpanded $name/%s templates
- clause 0 [high] `packages/contracts/src/cms-composition/refusals-operations.test.ts` :: BE03c Slice 12 typed refusals per operation > [P2-S12-AC-274] names an allowlist for exactly the 22 Slice 12 operations of the error catalog
  - rejected: monolithic catalog-wide clause across 22 operations: the contract tests (closed 409/422/403 token sets, one status per token, per-operation allowlists, catalog status resolution) are strong partial candidates, but the Worker half (503 never success-shaped, unmapped status -> scrubbed 500 on every operation) is covered per operation by templated suites and is not enumerated here; candidate titles use a ' > ' joiner or unexpanded $name/%s templates
- clause 0 [high] `packages/contracts/src/cms-composition/error-catalog.test.ts` :: BE03c normative application error catalog > [P2-S12-AC-274] resolves a status to the catalog code of an operation and refuses a status outside the catalog
  - rejected: monolithic catalog-wide clause across 22 operations: the contract tests (closed 409/422/403 token sets, one status per token, per-operation allowlists, catalog status resolution) are strong partial candidates, but the Worker half (503 never success-shaped, unmapped status -> scrubbed 500 on every operation) is covered per operation by templated suites and is not enumerated here; candidate titles use a ' > ' joiner or unexpanded $name/%s templates
- clause 0 [high] `apps/worker/src/cms-composition/phase-02-slice-12-dependency-unavailable.test.ts` :: [P2-S12-AC-008] CMS-03C dependency failures are DEPENDENCY_UNAVAILABLE > $name > a port that throws answers 503 DEPENDENCY_UNAVAILABLE without its prose
  - rejected: monolithic catalog-wide clause across 22 operations: the contract tests (closed 409/422/403 token sets, one status per token, per-operation allowlists, catalog status resolution) are strong partial candidates, but the Worker half (503 never success-shaped, unmapped status -> scrubbed 500 on every operation) is covered per operation by templated suites and is not enumerated here; candidate titles use a ' > ' joiner or unexpanded $name/%s templates
- clause 0 [high] `apps/worker/src/cms-composition/governed-review-provider-fault.test.ts` :: CMS-03C-06 provider 4xx without a product token (BE03c 1298-1302) > scrubs %s to 500 INTERNAL_ERROR
  - rejected: monolithic catalog-wide clause across 22 operations: the contract tests (closed 409/422/403 token sets, one status per token, per-operation allowlists, catalog status resolution) are strong partial candidates, but the Worker half (503 never success-shaped, unmapped status -> scrubbed 500 on every operation) is covered per operation by templated suites and is not enumerated here; candidate titles use a ' > ' joiner or unexpanded $name/%s templates
- clause 0 [high] `apps/worker/src/cms-composition/pattern-definition-provider-fault.test.ts` :: pattern definition $name: provider 4xx without a product token > scrubs %s to 500 INTERNAL_ERROR
  - rejected: monolithic catalog-wide clause across 22 operations: the contract tests (closed 409/422/403 token sets, one status per token, per-operation allowlists, catalog status resolution) are strong partial candidates, but the Worker half (503 never success-shaped, unmapped status -> scrubbed 500 on every operation) is covered per operation by templated suites and is not enumerated here; candidate titles use a ' > ' joiner or unexpanded $name/%s templates

## P2-S12-AC-275

- clause 0 [high] `tests/contracts/phase-02-slice-12-governed-review-openapi.test.ts` :: Slice 12 governed review registry rows and generated OpenAPI (CMS-03C-06 to CMS-03C-11) > [P2-S12-AC-136] keeps the internal CMS-03C-18 to CMS-03C-21 operations and their records out of the browser inventory and OpenAPI
  - rejected: no single parity test over the 17 operations and 5 reads exists (per-file openapi tests only), and Hono route discovery vs registry is not asserted as one parity; the 18-21 absence half is asserted
- clause 0 [medium] `tests/contracts/phase-02-slice-12-pattern-openapi.test.ts` :: Slice 12 pattern registry rows and generated OpenAPI (CMS-03C-12 to CMS-03C-15) > [P2-S12-AC-106] keeps the fixed pattern routes distinct from the latest-read path
  - rejected: no single parity test over the 17 operations and 5 reads exists (per-file openapi tests only), and Hono route discovery vs registry is not asserted as one parity; the 18-21 absence half is asserted
- clause 0 [medium] `tests/contracts/phase-02-slice-12-taxonomy-version-openapi.test.ts` :: Slice 12 taxonomy registry rows and generated OpenAPI (CMS-03C-16, CMS-03C-17 and the vocabulary reads) > [P2-S12-AC-130] keeps the vocabulary routes distinct from the selector path
  - rejected: no single parity test over the 17 operations and 5 reads exists (per-file openapi tests only), and Hono route discovery vs registry is not asserted as one parity; the 18-21 absence half is asserted
- clause 0 [medium] `tests/contracts/phase-02-slice-12-template-openapi.test.ts` :: Slice 12 CMS-03C-01 canonical OpenAPI authority > registers the served template version route with conditional revision control
  - rejected: no single parity test over the 17 operations and 5 reads exists (per-file openapi tests only), and Hono route discovery vs registry is not asserted as one parity; the 18-21 absence half is asserted

## P2-S12-AC-276

- clause 0 [high] `apps/worker/src/cms-composition-production-locale.test.ts` :: CMS-03C-04 production locale adapter > [P2-S12-AC-276] maps the typed retryable CONFLICT of a residual deadlock to the 409 locale catalog code
  - rejected: monolithic lock-order clause; the locale adapter maps a stubbed residual-deadlock CONFLICT to the locale catalog 409 and the race module is a race-tool citation (out of scope this pass); the lock positions and capability re-proof under locks are pgTAP/race

## P2-S12-AC-280

- clause 4 [high] `tests/postgrest/phase-02-slice-12-locale-variant.apispec.ts` :: CMS-03C-04 author a locale variant through the real stack > [P2-S12-AC-054] [P2-S12-AC-056] a variant is a strict 201 draft with the aggregate ETag, an immutable target revision, one audit and one outbox event
  - rejected: (clause 4) roll-up 'implement locked behavior and completion exactly': the real-stack cases prove the 201 and the 409s, but the roll-up spans AC-233..237 and the browser CmsLocaleVariantForm completion; one or two cases cannot discharge it
- clause 4 [high] `tests/postgrest/phase-02-slice-12-locale-variant.apispec.ts` :: CMS-03C-04 author a locale variant through the real stack > [P2-S12-AC-056] a stale entry version, a stale source hash and a fallback chain that differs from the active one are 409 and write nothing
  - rejected: (clause 4) roll-up 'implement locked behavior and completion exactly': the real-stack cases prove the 201 and the 409s, but the roll-up spans AC-233..237 and the browser CmsLocaleVariantForm completion; one or two cases cannot discharge it

## P2-S12-AC-281

- clause 3 [low] `tests/postgrest/phase-02-slice-12-locale-variant.apispec.ts` :: CMS-03C-04 author a locale variant through the real stack > [P2-S12-AC-055] an absent source revision and an entry another owner holds are the same 404 LOCALE_SOURCE_NOT_FOUND
  - not selected: no individual verdict recorded: redundant to the cited tests of the same clause, a neighbour/analogue of the clause, or its criterion was left uncited as monolithic (see the criterion limitation)

## P2-S12-AC-284

- clause 0 [medium] `apps/web/src/components/cms-related-content/CmsRelatedContentForm.conflict.test.tsx` :: CmsRelatedContentForm: 409 review, reapply and discard > keeps the ordered pins, the rule and the entered bound, and offers Review changes
  - rejected: monolithic: the related-content form's 409 review case is UI recovery; deletion/cascade after a pin becomes ineligible have no dedicated test

## P2-S12-AC-285

- clause 0 [high] `apps/web/src/components/cms-related-content/CmsRelatedContentForm.save.test.tsx` :: CmsRelatedContentForm: saving > sends the ordered pins, exclusions and chosen rule with the entry version, csrf token and a fresh key
  - rejected: one clause carries ~14 interaction obligations (single clause for the whole sentence); the related-content form tests cover several (request, result heading, replay key, fixed refusal, conflict review) but not scoped draft before commit, URL navigation/filter or a real-browser focus, and no Playwright spec exists. Needs per-obligation clauses before it can be cited
- clause 0 [high] `apps/web/src/components/cms-related-content/CmsRelatedContentForm.save.test.tsx` :: CmsRelatedContentForm: saving > announces the saved rule set and eligible count in the focused result heading, and moves to the next version
  - rejected: one clause carries ~14 interaction obligations (single clause for the whole sentence); the related-content form tests cover several (request, result heading, replay key, fixed refusal, conflict review) but not scoped draft before commit, URL navigation/filter or a real-browser focus, and no Playwright spec exists. Needs per-obligation clauses before it can be cited
- clause 0 [high] `apps/web/src/components/cms-related-content/CmsRelatedContentForm.save.test.tsx` :: CmsRelatedContentForm: idempotency > replays the identical request with the same key after an unknown outcome
  - rejected: one clause carries ~14 interaction obligations (single clause for the whole sentence); the related-content form tests cover several (request, result heading, replay key, fixed refusal, conflict review) but not scoped draft before commit, URL navigation/filter or a real-browser focus, and no Playwright spec exists. Needs per-obligation clauses before it can be cited
- clause 0 [high] `apps/web/src/components/cms-related-content/CmsRelatedContentForm.refusals.test.tsx` :: an ineligible target (422 related_target_ineligible) > marks the offending pin row with the one fixed message and no other row
  - rejected: one clause carries ~14 interaction obligations (single clause for the whole sentence); the related-content form tests cover several (request, result heading, replay key, fixed refusal, conflict review) but not scoped draft before commit, URL navigation/filter or a real-browser focus, and no Playwright spec exists. Needs per-obligation clauses before it can be cited
- clause 0 [high] `apps/web/src/components/cms-related-content/CmsRelatedContentForm.conflict.test.tsx` :: CmsRelatedContentForm: 409 review, reapply and discard > reads the protected draft detail first and then the saved rule on Review changes, with no save and no mutation header
  - rejected: one clause carries ~14 interaction obligations (single clause for the whole sentence); the related-content form tests cover several (request, result heading, replay key, fixed refusal, conflict review) but not scoped draft before commit, URL navigation/filter or a real-browser focus, and no Playwright spec exists. Needs per-obligation clauses before it can be cited
- clause 0 [high] `apps/web/src/pages/app/cms-content-modeling/entries/[entryId]/related-content-route.test.tsx` :: CMS-03C-05 protected related-content page, composed > serves the editing form once the composed read supplies the saved rule, with the picker and the version
  - rejected: one clause carries ~14 interaction obligations (single clause for the whole sentence); the related-content form tests cover several (request, result heading, replay key, fixed refusal, conflict review) but not scoped draft before commit, URL navigation/filter or a real-browser focus, and no Playwright spec exists. Needs per-obligation clauses before it can be cited

## P2-S12-AC-286

- clause 2 [low] `packages/contracts/src/cms-editorial/entry-create.test.ts` :: cms entry create body (CMS-03B-10) > rejects unknown keys and every caller-supplied authority field
  - rejected: pgTAP default-template derivation (RED authored); the race module is out of scope this pass and the entry-create contract rejects caller authority keys generally (low confidence)

## P2-S12-AC-290

- clause 0 [low] `apps/web/src/components/cms-editorial/cms-editorial-entry-create-setup.test.tsx` :: DEC-202 entry-create setup refusals > 422 announces exact neutral copy and retains typed work
  - rejected: no assertion creates against an incompatible default template; the web 422 copy test is UI response only

## P2-S12-AC-291

- clause 1 [medium] `apps/web/src/components/cms-editorial/cms-editorial-entry-create-setup.test.tsx` :: DEC-202 entry-create setup refusals > 409 focuses the named form summary without inventing a field
  - rejected: 409 focuses the named form summary; not the copy/identity exposure
