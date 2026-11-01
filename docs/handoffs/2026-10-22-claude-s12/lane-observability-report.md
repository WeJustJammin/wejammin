# Lane claude_s12_observability report

## Status
GREEN for what the Worker can observe; PARTIAL on three spec-named counters and two alert gauges whose event or data source does not exist in the Worker (BOUNDARY, below). Final: my 13 new test files 192/192; full `apps/worker` + `packages/observability` + `tests/observability` project run 712 files / 12,542 tests, exit 0 (run 14:42:52); worker `tsc --noEmit` exit 0; `packages/observability` `tsc --noEmit` exit 0; eslint --max-warnings=0 and prettier --check clean on every touched TS file; `tests/documentation-boundaries.test.ts` 5/5; 15/15 targeted mutations killed.

## Scope
P2-S12-AC-263 (the twelve Slice 12 metrics), AC-264 (alerts, trace coverage, allowlisted structured logs), and the counter halves of AC-051 (`cms_no_fallback_block_total`) and AC-052 (`cms_locale_stale_total`). Vitest only; no DB, docker, staging, canonical gate.

## Precedent mirrored (read before any edit)
- Metrics are the `metrics` member of one structured log line (`@wejammin/observability/logging` `LogMetricsSchema`; key built by `apps/worker/src/content-schema-registry/route-metric-key.ts` `metricKey`). Route modules learn closed facts; the production telemetry closure writes the line (precedent: `cms-composition-production-governed-review.ts` activation counter). S11: `cms-editorial/workflow-telemetry.ts` + `packages/contracts/src/cms-editorial/observability.ts` (`CMS_SLICE_11_METRICS` registry), traces as `traceSteps`, per-request stage marks `cms-editorial/route-stages.ts`.
- Alerts: S09 provider-free policy `packages/observability/src/content-schema-registry-alert-*.ts` + `infra/observability/` barrel/boundary + `tests/observability/`. S10/S11 deploy no alert rule (cms-editorial runbook says so); S09 documents that deployment still must prove the provider rule.
- Already emitted before this lane (intake said 2 of 12; grep shows 3): `cms_governed_activation_total` (route + sweep), `cms_governed_schedule_blocked_total` (sweep), `cms_governed_review_invalidated_total{reason}` (`governed-recheck/job.ts`, both reasons).

## Design (what was built)
1. `observability-registry.ts`: executable registry of the 12 + `cms_no_fallback_block_total` metrics with closed label values from contracts vocabularies; `metricKeyConforms`; the seven BE03c trace stages (`CMS_COMPOSITION_TRACE_STAGES`, each with its observing seam); the log-field and `attributes` allowlists; `CMS_SLICE_12_UNEMITTED_METRICS` (the boundary list).
2. `observability-facts.ts`: per-`Request` closed facts (decoded subject kind / decision / update action, stages reached, acting context, the PUBLISHED refusal reduced to catalog code + closed reason token + closed canonical domain; message, violations, canonical id dropped at note time).
3. `observability-instrument.ts`: wraps a family's `resolveSession` and ports at registration (principal stage, idempotency+RPC for a write port, RPC for a read port); pass-through of args/results, unreadable results never change the outcome (debug-by-test, see Runs 14:2x).
4. `observability-metrics.ts` (counters per operation), `observability-no-fallback.ts` (AC-051 from published preflight members; separate module to avoid an import cycle with `cms-editorial/workflow-telemetry`), `observability-observation.ts` (`observeRequest`, `compositionRequestLog`, `compositionInvalidationLog`).
5. Every Slice 12 route family sets `observation` on its one telemetry event; every production closure writes it through `compositionRequestLog`.
6. Alerts: `packages/observability/src/cms-composition-alert-*.ts`, `infra/observability/cms-composition-alert-{policy,boundary}.ts`.

## Metric by metric
| Metric | Where emitted | Labels |
| --- | --- | --- |
| `cms_governed_review_total` | CMS-03C-06 request event (decoded subject kind) | subject_kind, outcome |
| `cms_governed_decision_total` | CMS-03C-07 request event (decoded decision) | decision, outcome |
| `cms_governed_activation_total` | unchanged: CMS-03C-09 route, activation sweep | subject_kind, action, outcome |
| `cms_governed_review_invalidated_total` | recheck job (unchanged); NEW own event `...request.invalidated` for a committed `dependency_changed` refusal of CMS-03C-07/09 | reason |
| `cms_governed_schedule_blocked_total` | unchanged: activation sweep | reason |
| `cms_pattern_update_total` | CMS-03C-15 request event (decoded action) | action, outcome |
| `cms_canonical_match_total` | refusals `canonical_overlap` (match) / `canonical_source_unavailable` (source_unavailable) of CMS-03C-03/06/09 | domain, outcome |
| `cms_canonical_source_unavailable_total` | `canonical_source_unavailable` refusal | domain |
| `cms_related_target_ineligible_total` | the uniform 422 of CMS-03C-05 | none |
| `cms_locale_limit_reached_total` | 409 `locale_limit_reached` of CMS-03C-04 | none |
| `cms_no_fallback_block_total` | S11 route event: failed `locale` preflight member with its closed reason, ops 03B-05/07/09/15 | reason |
| `cms_locale_fanout_total`, `cms_locale_stale_total`, `cms_pattern_linked_update_pending_total` | NOT EMITTED, BOUNDARY | |

## Alerts (AC-264)
`evaluateCmsCompositionAlerts(snapshot)` in the order DLQ > 0, outbox age > 120,000 ms, activation blocked > 900,000 ms, stale locale legal-field count > 0, target-filter count above its preceding-window baseline; all strictly "above", missing/non-finite never alerts, route `platform.on_call`, runbook `cms-composition`. Outbox and activation numbers are imported from the S09 thresholds. The target-filter rule follows the S09 spike convention (current five-minute count above the preceding baseline) because BE03c names the anomaly without a number: implementation decision, root may override.

## Files
New files (lines, SHA-256 prefix at the final run):
| File | Lines | SHA-256 (16) |
| --- | --- | --- |
| `apps/worker/src/cms-composition/observability-facts.ts` | 88 | 852e0bb45bc4a8d4 |
| `apps/worker/src/cms-composition/observability-instrument.ts` | 71 | 4570ac1da5c70eee |
| `apps/worker/src/cms-composition/observability-metrics.ts` | 114 | da822a1954c13037 |
| `apps/worker/src/cms-composition/observability-no-fallback.ts` | 45 | 99e1222e99d49210 |
| `apps/worker/src/cms-composition/observability-observation.ts` | 162 | dd6fc6d2400e215d |
| `apps/worker/src/cms-composition/observability-registry.ts` | 225 | aef48d5b5499040c |
| `apps/worker/src/cms-composition/observability-{registry,metrics,observation,instrument,governed,pattern-update,taxonomy,related-locale,no-fallback}.test.ts` | 176 / 360 / 366 / 129 / 328 / 201 / 210 / 184 / 142 | see disk |
| `apps/worker/src/cms-composition/governed-recheck/observability.test.ts` | 90 | 1b3a400c447c41ef |
| `apps/worker/src/cms-composition-production-observability.test.ts` | 260 | 3d9bfa77fe46e1a6 |
| `apps/worker/src/cms-governed-activation-sweep-registry.test.ts` | 131 | d289495fbdd0dc67 |
| `packages/observability/src/cms-composition-alert-{types,thresholds,evaluator}.ts`, `cms-composition-alerts.ts` | 39 / 15 / 70 / 8 | 49924d79dda806cd / cbf32a8f86a01b3f / 95cfe8a02e8f8202 / 4bb14c3bd8b99ec6 |
| `infra/observability/cms-composition-alert-{policy,boundary}.ts` | 15 / 22 | e50c6aa43826fc08 / 9300ac73927fd3c2 |
| `tests/observability/phase-02-slice-12-alert-policy.test.ts` | 159 | 7b7ae3974c6450a3 |

Existing files edited, all additive (named before editing; most are untracked in git so `git diff` cannot isolate them): see "Edit log of EXISTING files" below. READMEs: `apps/worker/src/cms-composition/README.md`, `infra/observability/README.md`, `packages/observability/src/README.md`.
Hygiene note: `prettier --write` was applied to the files this lane edited; `governed-recheck/job.ts` and `source-consumers.ts` were not prettier-clean before, so their diff contains formatting churn.


## Runs
- 14:08 `tests/observability/` RED (module absent, genuine missing feature) then GREEN 31/31 (incl. S09 policy/boundary).
- 14:11 registry + metrics tests 53/53; NOTE the implementation was written in the same step as these two test files, so no RED run of them exists; the mutation proofs below stand in for it.
- 14:12 observation tests RED (module absent) then GREEN, 3 files 73/73.
- 14:13 governed integration RED (14/16 failing for the missing feature; one fixture bug of mine: a reject decision needs a `rejected` review) then GREEN 16/16 after wiring (`governed-review-*`, closure, fresh-context stage mark).
- 14:16 CMS-03C-09 exact-map oracle `governed-activation-metrics.test.ts` failed once the invalidation counter joined the request counters: redesigned to its own event (`...request.invalidated`), no oracle edit.
- 14:17-14:20 pattern-update, taxonomy, related+locale, then the remaining families (pattern instance/definition, template, taxonomy definition): each RED first (14 / 7 / 8 failing, observation absent), GREEN after wiring; two exact event-shape oracles needed the additive `observation` member (Test corrections).
- 14:22 debug-by-test: `template-context-routes.test.ts` "enforces a total deadline and catches unexpected execution failures" went 500 -> 503 because the stage wrapper read a throwing session proxy; fixed in `observability-instrument.ts` (observation never throws), pinned by `observability-instrument.test.ts` ("never changes the outcome for a session result that throws on access").
- 14:29 consumer trace RED (2/4) then GREEN; 14:30 no_fallback wiring RED (5/8) then GREEN; import cycle found by reading (route-telemetry -> workflow-telemetry -> observability-metrics -> route-telemetry) and removed by moving `noFallbackBlockMetrics` to `observability-no-fallback.ts`.
- 14:32 mutation run (script in the lane scratchpad): 15 mutants, 14 killed, 1 survivor (a stray `attributes.path` member); the log tests now pin the `attributes` key set (`CMS_COMPOSITION_LOG_ATTRIBUTES`) and the mutant is killed (15/15): alert `>`->`>=` x2, refusal domain/reason not validated x2, audit_outbox for any status, missing idempotency mark, decision outcome mapping, related counter on any 422, no_fallback any reason, attribute leak, submit fact not noted, refusal not noted, consumer step dropped, refetch mark dropped, invalidation merged.
- 14:36 first full `apps/worker`+`packages/observability`+`tests/observability`: 712 files / 12,542 tests, exit 0. Worker tsc then flagged type casts in my closure test (fixed, test-only).
- 14:42 final full run, same command: 712 files / 12,542 tests, exit 0, 316.8 s; worker tsc exit 0; observability tsc exit 0; eslint + prettier clean on all touched files.
- Focused final: 13 new test files, 192/192.


## Edit log of EXISTING files
Additive only (`noteRefusal` at the error builder, `observation: observeRequest(...)` on the one telemetry event, `instrumentComposition(...)` at registration, a typed optional `observation?` member, `facts` hook), plus the listed exceptions.
- `apps/worker/src/cms-composition/` governed review: `governed-review-{ports,response,errors,command-routes,routes}.ts`; pattern update: `pattern-update-{ports,response,routes}.ts`; taxonomy term action: `taxonomy-{contracts,responses,routes}.ts`; locale: `locale-routes.ts`, `locale-routes-{types,responses,run}.ts`; related content: `related-content-{types,route-helpers,run,routes}.ts`; pattern instance: `pattern-instance-{contracts,responses,routes}.ts`; pattern definition: `pattern-definition-{ports,response,routes,latest-routes}.ts`; template: `template-{shared,respond,routes,version-routes,context-routes,detail-routes}.ts`; taxonomy definition/reads: `taxonomy-definition-{shared,response,routes}.ts`; recheck consumers: `governed-recheck/{job,source-consumers}.ts` (one `traceSteps` line each).
- OUTSIDE the literal claim (the emission points of these events are the production closures, as for the existing activation counter): `apps/worker/src/cms-composition-production{,-governed-review,-locale,-related,-pattern,-pattern-definition,-pattern-update,-taxonomy,-taxonomy-definition}.ts` (inline log literal replaced by `compositionRequestLog(event, names)`; the governed closure also writes the invalidation event and keeps merging the activation counter), `apps/worker/src/cms-editorial-production-fresh-context.ts` (one `noteStage('registry_refetch')` line), `apps/worker/src/cms-editorial/workflow-telemetry.ts` (S11 file: AC-051 counter, imports `observability-no-fallback`, 8 lines), `packages/observability/package.json` (one export).
- Not touched: `apps/worker/src/async-entrypoint.ts`, `async-runtime-rpc-types.ts`, `production-async-entrypoint*.ts`, apps/web, contracts, SQL/WIP, pgTAP, tracker, ledger.

## Test corrections
Both are additive (`observation: expect.any(Object)`), nothing weakened; an exact `toHaveBeenCalledWith` oracle of the event shape cannot hold when BE03c requires the event to carry its trace and counters:
1. `apps/worker/src/cms-composition/pattern-update-faults.test.ts` ~line 172: added `observation: expect.any(Object),` to the expected event object (3 parametrised cases CMS-03C-13/14/15).
2. `apps/worker/src/cms-composition/template-routes.test.ts` ~line 180: same line added to the expected CMS-03C-01 event.
Considered and avoided a third: `governed-activation-metrics.test.ts` pins the whole `metrics` map of a CMS-03C-09 `dependency_changed` refusal to the single activation counter, so the invalidation counter is emitted in its own event instead of being added to that map.

## Spec citations
BE03c 1556 (locale gate, `cms_no_fallback_block_total`), 1560 (fan-out, `cms_locale_stale_total{locale}`, 32-variant limit), 1761-1767 (Observability: metrics list, labels never carry id/label/locale/hash/person, alerts, traces, allowlisted diagnostics), 1262/1326 (`dependency_changed` committed invalidation), 1375 (canonical domain member), refusals.ts (closed tokens). BE03a 2801 and BE03b 2185 trace chains (precedent shape). DEC-121/DEC-122 (AC-051/052).

## Open items / BOUNDARY
1. `cms_locale_fanout_total`: the fan-out runs synchronously inside the revision writers (PostgreSQL, BE03c 1560); no Worker request or consumer observes it and no spec line names a path from that transaction to a Worker counter. Missing: a BE03c/BE00 sentence naming it (e.g. a consumer of `cms.localization.changed.v1`, or a DB-gauge RPC). Same finding as the locale lane BOUNDARY.
2. `cms_locale_stale_total{locale}` (AC-052 counter half): same missing seam, PLUS an internal spec contradiction: line 1765 labels it with `locale` while the same paragraph says labels never carry locale text. Not emitted; the spec must choose (drop the label, or allow the closed 32-tag set).
3. `cms_pattern_linked_update_pending_total`: the `cms.pattern.linked_update_scan` consumer (AC-212/213) does not exist in the Worker, so no event can increment it. The registry holds the name; add the one-line counter where the consumer lands.
4. `cms_canonical_match_total{outcome="no_match"}`: the clean pass is inside the database; the Worker sees only refusals, so only `match` and `source_unavailable` are counted.
5. `cms_no_fallback_block_total` counts the published refusals of the four preflight-bearing routes. Gate evaluations inside the scheduled-execute sweep and inside delivery (`execute` phase, CMS-15) are database-internal; the sweep reports only a closed block reason without the locale reason, so they are not counted. CMS-03B-15 workflow reads that serve a failing locale entry in a success body are not counted (the route fact carries no reason token); only refusals are.
6. Alert gauges with no source yet: `staleLocaleLegalFieldCount` (needs a protected read over `cms_locale_stale_fields` filtered to legal/safety/jurisdiction `no_fallback` fields) and `targetFilterCount/Baseline` (needs the `cms_related_target_filtered_total` emitter in the Shard 04 projection/CMS-15 delivery; no emitter exists in the repository). The policy and its boundary are provider-free like S09; no provider-side rule or snapshot builder for Slice 12 is deployed (S11 documents the same state for its alerts).
7. Trace stages `audit_outbox` (inferred from a committed write answered below 400, BE03c: audit failure rolls the command back) and `registry_refetch` (the shared fresh-context re-proof, marked in `cms-editorial-production-fresh-context.ts`) are observed at the Worker seam; the DB-side spans are PostgreSQL authority.
8. No `docs/runbooks/platform/cms-composition.md` exists although every Slice 12 event already carries `runbook: 'cms-composition'` and the new alerts name it.

## Requests to root
1. Ratify the edits OUTSIDE the literal claim (all additive): the nine production telemetry closures `apps/worker/src/cms-composition-production{,-governed-review,-locale,-related,-pattern,-pattern-definition,-pattern-update,-taxonomy,-taxonomy-definition}.ts` (inline log literal replaced by `compositionRequestLog(event, names)`; the activation counter merge stays in the governed closure), `apps/worker/src/cms-editorial-production-fresh-context.ts` (one `noteStage` line), `apps/worker/src/cms-editorial/workflow-telemetry.ts` (S11, AC-051 counter, 8 lines), `packages/observability/package.json` (one export), the three README files, `pattern-update-faults.test.ts` and `template-routes.test.ts` (Test corrections). The emission points of Slice 12 events are the production closures, so the claim text could not be met otherwise.
2. Decide BOUNDARY items 1, 2, 3, 6 (spec sentence naming the DB-to-Worker path for fan-out/stale, resolution of the `locale` label contradiction, the scan consumer, and the two alert gauge sources); I recorded, did not invent.
3. Add `docs/runbooks/platform/cms-composition.md` (alert triage for the five codes) and, if wanted, mirror `CMS_SLICE_12_METRICS` into `packages/contracts/src/cms-composition/` as S11 did (contracts were frozen for me).
4. Evidence ledger rows for AC-263/AC-264/AC-051/AC-052 are not touched (tracking is root's). Do not tick AC-263/AC-264 before the BOUNDARY items are decided; AC-051's route counter and AC-263's nine emitted counters are proven.
