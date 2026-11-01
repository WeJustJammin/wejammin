# Slice 11 evidence ledger lane A: gap report for P2-S11-AC-001..034

Lane A, ledger fragment `tests/contracts/phase-02-slice-11-evidence-ledger-001-034.ts`.

## Provenance

- Worktree `/home/rob/.codex/worktrees/phase2-slice11/WeJammin`, branch `claude/phase2-slice11`.
- First command of the lane saw HEAD `618ec5c16585d295263770a9d79138f36bfa10dc`. HEAD moved to
  `9b9b588ed3ef5409f3fdfcbf1ff179eb13ab0a0f` ("land exact schedule precision producers") while the lane ran.
  Every citation was resolved by script against the working tree at write time. Between the two HEADs only
  `supabase/tests/phase_02_slice_11_rpc_publication_schedule_refusals.sql` changed among the 68 cited test files
  (the description now says "at most nine fraction digits"). The working tree also carries an uncommitted edit of
  `supabase/tests/phase_02_slice_11_helpers_preflight.sql` (plan 157 to 162) by another lane; none of the descriptions
  this fragment cites from it changed.
- Nothing was executed (no tests, node, pnpm, psql). Titles were taken from source and checked mechanically: each
  vitest title exists in its file (generated titles were expanded by hand from the loop or `it.each` data and checked
  against the vitest 4.1.11 `formatTitle` rules, including the quoted `$prop` string form), each pgTAP description is
  a whole SQL string literal of exactly one file, each race line is a static `ok -` message. Clause tiling, status
  rules, sole-proof counts (no citation is the sole citation of clauses of more than 3 criteria; a few single-citation
  clauses such as the per-operation `rate` clause exist, each owned by one criterion) and duplicate titles in cited files
  were checked with a replica of the guard rules. Run `prettier --write` on the fragment (the emitter mimics prettier but
  could not be run).

## Counts

| Status | Count | Criteria |
| --- | --- | --- |
| verified | 30 | AC-001..003, 005..015, 017..021, 023..033 |
| partial | 4 | AC-004, AC-016, AC-022, AC-034 |
| unverified | 0 | none |

864 citations (vitest, pgtap, race). No Playwright citation: no Slice 11 browser test proves a clause of these 34
criteria that a lower layer does not prove better.

## Sections for criteria that are not verified

### P2-S11-AC-004 — partial
- Unproven clause(s): "template, block" and "relation, route, locale, and privacy gates re-pass."
  (Cited: "Publish only after current revocation", "accessibility", "settings, schema", "media".)
- Implementation: present. Evaluator `supabase/migrations/20261005017570_cms_preflight_evaluation.sql:185`
  (`cms_evaluate_preflight`, 17 categories); the schedule/publish phase wrapper that calls it with phase `publish`
  `supabase/migrations/20261005017700_cms_publication_command_support.sql:301`; command
  `supabase/migrations/20261005017720_cms_publish_revision.sql:35` (private) and `:214` (wrapper).
- Missing evidence: pgTAP. The per-category failure tests (`phase_02_slice_11_helpers_preflight.sql`) all call
  `h11p_request('submit', ...)`; the publish phase is exercised only for revocation, accessibility, media (the `pr-media`
  case in `phase_02_slice_11_rpc_publication_publish_refusals.sql`) and version-set/manifest equality. Add to
  `phase_02_slice_11_rpc_publication_publish_refusals.sql` (or `helpers_preflight.sql` with phase `publish` and a
  publisher actor) one fixture per remaining gate and assert `P0001:preflight_failed` with exactly that category
  `failed` and the other 16 entries present, plus no lineage row, event or audit record: template
  (`template_not_active`), block (`block_withdrawn`), relation (`relation_target_unavailable`), route (rich-text
  `internal` link, `provider_unbuilt_reference`), locale (a `no_fallback` field), privacy (needs a fixture that fails
  privacy without also failing revocation; a held entry fails both, see `helpers_preflight.sql:456`). Optional real-stack
  twin in `tests/postgrest/phase-02-slice-11-publish-preflight.apispec.ts` for one reference-gate category. The settings
  and schema gates are cited only through the version-set equality check, not through the `schema`/`settings` preflight
  categories at publish phase; a `settings_changed` and a `schema_not_active` publish-phase case would close that too.
- Size: M (1-4h)

### P2-S11-AC-016 — partial
- Unproven clause(s): "redacted telemetry." (the clause "emit" is cited.)
- Implementation: present. Closed-label metrics `apps/worker/src/cms-editorial/workflow-telemetry.ts:58`
  (`workflowMetrics`); event builder `apps/worker/src/cms-editorial/route-telemetry.ts:206` (`buildRouteEvent`);
  facts assembled in `apps/worker/src/cms-editorial/workflow-command.ts:291`; sink
  `apps/worker/src/cms-editorial-production-telemetry.ts:28`.
- Missing evidence: vitest. `apps/worker/src/cms-editorial/workflow-command-facts.test.ts` has the redaction assertion
  for CMS-03B-05 only ("telemetry logs one redacted event with closed labels and the hashed entry"). Add the same
  shape for CMS-03B-06: post `decisionBody` (success and a refusal such as stale MFA) through `workflowHarness`, serialize
  the telemetry event(s) and assert none of the review id, decision reason text, `reviewResource` frozen/dependency hash
  or the session user id appears, `entityIdHash` matches `^sha256:[0-9a-f]{64}$`, and the metric key set is the closed
  `cms_review_decision_total` family.
- Size: S (<1h)

### P2-S11-AC-022 — partial
- Unproven clause(s): "redacted telemetry." (the clause "emit" is cited.)
- Implementation: present (same telemetry modules as AC-016; metrics `cms_preflight_result_total{phase="schedule"}`).
- Missing evidence: vitest. Extend `workflow-command-facts.test.ts` (or a sibling) with a CMS-03B-07 case: post
  `scheduleBody` and assert the serialized telemetry event contains none of the entry/revision/review/schedule ids, the
  expected version, `localDateTime`/`timezone`/`resolvedUtc`, and that `entityIdHash` is the only identity.
- Size: S (<1h)

### P2-S11-AC-034 — partial
- Unproven clause(s): "redacted telemetry." (the clause "emit" is cited.)
- Implementation: present (same telemetry modules; separation-of-duties and lineage-conflict counters in
  `workflow-telemetry.ts`).
- Missing evidence: vitest. Same extension for CMS-03B-09: post `publicationBody`, assert the serialized telemetry event
  omits entry/revision/publication ids, `frozenHash` and `expectedVersionSet` members, for success and for a
  `separation_of_duties` refusal.
- Size: S (<1h)

## Verified entries that lean on shared tests (not gaps, but the weakest verified spots)

- Pagination (AC-008, 014, 020, 026, 032): POST commands declare no pagination. The clause is cited with the strict
  "refuses any query string on a command" Worker test plus the no-store success envelope. No dedicated pagination test
  can exist.
- Internal failure to a typed ApiError (AC-015, 021, 027): operation-specific proof is the 502 "success payload breaks the
  resource contract" test per operation plus the shared `normalizedWorkflowError` 500/502/504 envelopes
  (`workflow-errors-typed.test.ts`, built on the CMS-03B-09 row). A real 500 raised for each of CMS-03B-06/07/08 exists
  only for CMS-03B-05 (unregistered raise, `cms-editorial-production-workflow-refusals.test.ts`) and CMS-03B-09
  (`cms-editorial-production-response-headers.test.ts`).
- Author/reviewer separation at API level (AC-001): proven in pgTAP (decision RPC, decision/assignment triggers) and the
  CMS-03B-09 API test; there is no real-stack CMS-03B-06 test where the submitter or revision author is the caller.
- Protected-risk approval with recent MFA (AC-001): protected approvals (pgTAP) and the MFA window (pgTAP + API step-up
  refusals on an ordinary review) are cited; no single test refuses a stale MFA instant on a protected review.
- Concurrency (AC-008, 014, 020, 026, 032): race runner lines that interpolate run output (for example the winner/loser
  token) cannot be cited, so the cited lines are the static state and blocking lines. The "exactly one commits, the other
  is typed" assertions (`C1`, `B1`, `S1`, `S2`, `M1`, `E1`, `E3`, `E4`, `L3` interpolated lines) are not citable until
  their message is made static.
- Worker admission, quota, deadline and error-boundary tests use a port-stub harness; they prove Worker behaviour before
  and after the port, while the real composition is proven by the `tests/postgrest/phase-02-slice-11-*.apispec.ts`
  citations alongside them.

## Closing lists

(a) Counts: verified 30, partial 4, unverified 0.

(b) Criteria whose implementation appears entirely missing: none of AC-001..034. Every operation has its SQL command,
Worker route, contracts and registry row (`apps/worker/src/cms-editorial/{review-submit,review-decision,schedule,preview,
publication}-routes.ts`, `supabase/migrations/20261005017*`).

(c) Cited tests believed failing or skipped, and risks to confirm on the first fresh run:
- No `skip`, `todo`, `fails`, `skipIf` or pgTAP `skip()` in any of the 68 cited files (scanned).
- `tests/postgrest/phase-02-slice-11-schedule-actions.apispec.ts`, test "[CMS-03B-07] nine-digit fractional schedule
  accepted by Worker remains accepted by SQL" (cited under AC-017): RED at 618ec5c1 per
  `docs/handoffs/2026-10-09-phase2-claude-handoff.md` (five 422-vs-202 failures); the five precision migrations landed in
  9b9b588e, so it needs a fresh run. The guard also requires the rest of that file to pass.
- `supabase/tests/phase_02_slice_11_rpc_publication_schedule_refusals.sql` (cited by AC-018..022, 002): its fraction-digit
  expectation was changed from six to nine digits in 9b9b588e; it passes only with the nine-digit admission migration.
- `supabase/tests/phase_02_slice_11_helpers_preflight.sql` (cited by AC-004): being edited in the working tree (plan 162);
  cited descriptions unchanged, but the whole file must be green.
- Many cited pgTAP entrypoints include `supabase/tests/phase_02_slice_11_schema/002-row-builders.sqlinc`, which changed in
  9b9b588e: fixture drift would fail them.
- Not cited on purpose (in-flight or other lanes): `phase-02-slice-11-schedule-precision*.apispec.ts`,
  `phase_02_slice_11_schedule_precision.sql`, sweep/claim/lease suites.
