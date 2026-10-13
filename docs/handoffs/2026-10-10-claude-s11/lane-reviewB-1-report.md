# Lane reviewB-1 report (2026-10-11)

Items: B-01 (locale-source currency, DEC-170), B-05 (unparseable relayed row), B-03 (recheck RPC wrappers and
takedown port import boundary). Worktree `/home/rob/.codex/worktrees/phase2-slice11/WeJammin`, branch
`claude/phase2-slice11`, HEAD `844117ca`. No git add/commit/stash/checkout/reset/restore was run. The previous agent of this
lane died after authoring the RED tests (snapshot `refs/backup/s11-claude-wip-3`); its RED tests were kept, checked for the
right failure reason, completed (two test-code defects fixed, listed below) and turned GREEN. Logs are in
`docs/handoffs/2026-10-10-claude-s11/lane-reviewB-1-logs/`.

## Files changed

Production:
- `supabase/migrations/20261005017560_cms_dependency_manifest.sql` (in place; not on `main`, not MD5-pinned): `cms_manifest_identities_current`
  now checks every frozen `localeSources` identity (B-01); header and function comment updated. Signature, owner, SECURITY DEFINER,
  `search_path = ''`, volatility, grants unchanged.
- `apps/worker/src/async-runtime.ts`: `sweepOutbox` records a poison claimed row and completes its claim instead of returning `retry` (B-05).
- `apps/worker/src/async-runtime-outbox-poison.ts` (new): `parsePoisonedOutboxRow`, `OUTBOX_RELAY_CONSUMER`.

Tests and support:
- New: `apps/worker/src/async-runtime-outbox-poison.test.ts` (20), `supabase/tests/phase_02_slice_11_recheck_locale_source.sql` (32),
  `supabase/tests/phase_02_slice_11_outbox_relay_poison.sql` (14), `tests/postgrest/support/phase-02-slice-11-recheck-fixtures.ts`,
  `apps/worker/src/import-graph.test-support.ts`, `apps/worker/src/import-graph.test.ts` (5),
  `apps/worker/src/cms-editorial-principal-boundaries.test-support.ts`, `apps/worker/src/cms-editorial-principals-mutation.test.ts` (22).
- Modified: `apps/worker/src/cms-editorial-principals.test.ts` (+6 tests), `tests/postgrest/phase-02-slice-11-recheck.apispec.ts` (+7 tests),
  `supabase/tests/phase_02_slice_11_helpers_manifest.sql` (plan 87 -> 88, see "Old -> new"), `apps/worker/src/node-test-modules.d.ts`
  (type shim: `copyFileSync`, `mkdirSync`, `mkdtempSync`, `rmSync`, `writeFileSync`, `node:os` `tmpdir`, `node:path` `relative`; needed by
  the new tests under `tsc --noEmit`).
- Docs: `apps/worker/README.md`, `apps/worker/src/cms-editorial/review-recheck/README.md`.
- `import-graph.test-support.ts` is also imported by `cms-publication-schedule-import-graph.test.ts` (another lane's). I only memoized the
  per-file TypeScript parse (keyed by file text) and ran prettier; exports and semantics are unchanged.

## B-01 locale-source currency (DEC-170)

- Rule implemented (SQL, `cms_manifest_identities_current`): a frozen `{locale, revisionId, hash}` is current only while (1) that source revision
  exists in that locale with that `payload_hash`, (2) the latest revision of that locale of the entry carries that hash, and (3) no variant
  sourced from that revision and hash has state `stale`. A stale marking is never lifted, so a source edited then reverted stays non-current;
  a newer source revision with the same hash changes nothing. The check runs before the settings snapshot is read, so it adds no write.
  Because both the recheck job and CMS-03B-07/09 go through `cms_frozen_dependencies_status`, one change fixes all three.
- RED (`lane-reviewB-1-logs/red-pgtap.out`): `phase_02_slice_11_recheck_locale_source.sql` failed 12 of 32:
  test 16 "an edited source, and one edited then reverted to the frozen hash, make the frozen locale-source identity non-current ..." (status
  stayed `current/true`), 17 (absent source / foreign hash / other locale not rejected), 23-28 (the recheck run answered `invalidated 0`,
  review stayed `approved`), 29-32 (CMS-03B-09 and CMS-03B-07 did not answer `version_set_stale`). Real stack
  (`red-api.out`): the localization run answered `{examined: 1, invalidated: 0}` instead of `invalidated: 1`.
  (The logs also showed three defects of the test code itself, fixed: `plan(23)` -> `plan(32)`; an unparenthesised `->>`/`||` chain in
  the apispec; and an unfiltered review-changed count in the idempotency test, which counted the review's submit and decision events too and
  is now compared before and after the redelivery.)
- GREEN: `green-pgtap-focused.out/.tap` (7 files, 256 tests pass); `green-api-recheck-2.out`: `phase-02-slice-11-recheck.apispec.ts` 13/13
  (real relay, consumer, job and database: localization describe holds an approved locale-variant review, edits the source through the real
  producer, relays `cms.localization.changed.v1`, resolves the SOURCE revision, runs the job: invalidated `dependency_changed`, one
  review-changed event, one audit record, idempotent under redelivery).
- Spec lines: BE03b "Review invalidation" (approval never survives a changed dependency), DEC-170 (BE03b change log 2026-10-11), AC-113.

## B-05 unparseable relayed row

- Rule: a claimed row `parseOutboxClaim` refuses is POISON. The sweep records it with the existing `consumer_dead_letter_event` (identifiers
  in their stored shape or null, closed reason `INVALID_QUEUE_PAYLOAD`, consumer `platform.outbox.sweep`), completes its claim with
  `complete_outbox_event`, and continues with the next row. A dead letter that fails, is not acknowledged, a claim that cannot be completed,
  a row that is not addressable (not an object, id not a UUID) and a row leased to another sweep all still return `retry`; nothing is dropped
  and nothing is deleted from the outbox (BE00: "never delete durable intent to hide failure"). Postgres hex UUIDs that are not RFC UUIDs are
  addressable. No new migration: both RPCs exist.
- RED (`red-worker.log`): 10 of 20 failed, first assertion `async-runtime-outbox-poison.test.ts:149`
  `expected 'retry' to be 'completed'` (the first poison row returned `retry` and relayed nothing behind it), then
  `expected [] to deeply equal [{ operation: 'consumer_dead_letter_event', ... }]`, plus 7 `parsePoisonedOutboxRow is not a function`.
  Real stack (`red-api.out`): `Outbox sweep requested retry` on the first relay; all six tests of the first describe failed from the relay on.
- GREEN: `green-worker-async-runtime.log` (12 `async-runtime*` files, 147 tests pass, 20 of them the new file);
  `phase_02_slice_11_outbox_relay_poison.sql` proves the database half (14 tests: the widened claim leases the history oldest first;
  the sanitised identity always satisfies the dead-letter checks; recording is idempotent; completing removes the row from the claim set; a row
  that is only skipped is claimed FIRST again after its lease expires, which is why acknowledging is required); the apispec proves it end to
  end: two seeded historical poison rows (a `cms.localization.changed.v1` with an invalid-variant correlation id and a `job.requested` with a nil
  causation id) become dead letters, are finalized, never queued, and the activation event behind them is relayed.
- Spec: BE00 "Event and Consumer Contracts" (queue consumers, outbox dispatcher), AC-113.

## B-03 import-graph boundary

- `cms-editorial-principals.test.ts` now pins, from a TypeScript-parser import graph (`import`, `import type`, `export ... from`, `export *`,
  `import x = require()`, `require()`, dynamic `import()`; comments, strings and packages are not edges), who may import
  `review-recheck/rpc-names` (value: `rpc.ts`; type-only: `async-runtime-rpc-types.ts`), `review-recheck/rpc` (value: `production.ts`),
  `review-recheck/production` (value: `production-async-entrypoint.ts`) and the preview takedown port (nobody, in any form); that the wrapper
  identifiers appear only where allowed; and `honours the whole recheck and takedown boundary`. The allow-lists live once in
  `cms-editorial-principal-boundaries.test-support.ts`.
- Mutation-proven in the suite: `cms-editorial-principals-mutation.test.ts` copies the shipped Worker sources to a scratch directory, checks the
  copy is clean, then applies 19 mutations one at a time (static, type-only, re-export, named re-export, dynamic, require, import-equals,
  side-effect, explicit-extension, nested-directory imports of the wrappers/names/composition/takedown port; a copied name table; a spelled
  recheck or takedown RPC literal) and requires each to be reported and attributed to the intruding file; deleting the intruder restores a
  clean report. Non-vacuity: with the checker neutralised (`recheckBoundaryViolations` returning `[]`) 20 of the 22 tests fail
  (`mutation-neutralized-checker.log`); restored afterwards (byte-identical).
- GREEN: principals 14 tests (8 existing + 6 new), mutation 22, import-graph helper 5 pass. The first importer test took 7.3 s cold and timed out at
  15 s on a loaded host in the previous run; the graph is now parsed once in a 180 s `beforeAll` and memoized.

## Old -> new test expectations (evidence ledgers cite titles)

- `phase_02_slice_11_helpers_manifest.sql`: title `control: a well-formed manifest (sorted, unique, populated optional groups) is still current
  [P2-S11-AC-090]` is UNCHANGED, but its population now excludes the `sorted localeSources` control: that control names fabricated source
  revisions, which DEC-170 makes non-current. Added `a well-formed manifest whose localeSources name revisions that do not exist is not current
  [P2-S11-AC-113]` (the same manifest is still asserted structurally valid by the next control). Plan 87 -> 88.
- No other existing title or expectation was changed, weakened or skipped. New tests carry `[P2-S11-AC-113]`; the new principal tests are
  `lets only the recheck port import the recheck RPC names (the shared RPC type reads them type-only)`,
  `lets only the recheck production composition import the recheck RPC ports`,
  `lets only the production async entrypoint import the recheck production composition`,
  `names the recheck RPC wrapper identifiers nowhere else (an alias or a copy would not be an import)`,
  `lets no Worker module import the preview takedown port in any form until its Shard 16 caller exists`,
  `honours the whole recheck and takedown boundary`. The existing `lets no Worker module import the preview takedown port until its Shard 16 caller exists` is untouched.

## Verification

- `pnpm exec eslint --max-warnings=0` and `prettier --check` clean on every file above; `tsc --noEmit` in `apps/worker` clean.
- pgTAP, all 91 `phase_02_slice_11_*.sql` on the alt stack (`green-pgtap-slice11-all.out/.tap`): 3,029 tests; 8 files fail, all from another
  lane's unfinished work and none in this lane's scope: `effect_oracle.sql` (bad plan, 9 planned vs 18 run), `reads_bench128.sql` (relation
  `b11_timing` does not exist) and one "every refusal ... changed no durable table" assertion in each of the six `*_refusals.sql` files
  (diagnostic `want: REPORT_PUBLISH`, a placeholder). Every other file passes, including all that touch manifests, reviews, recheck,
  schedules and publication.
- Worker vitest on everything that touches the relay, the entrypoints or this lane (`green-worker-relay-neighbours.log`): 35 files, 396 tests
  pass (`async-runtime*`, `async-entrypoint*`, `production-async-entrypoint*`, `index-scheduled`, the sweeps' production tests, `ac265-hosted`,
  `cms-editorial/review-recheck`, `cms-editorial-principals*`, `import-graph`).
- A whole-`apps/worker` run is not clean evidence on this loaded host (load average 9-11 from the other lanes): the first attempt did not finish
  in 35 minutes (vitest idle at 12% CPU; killed by me, hung file not identified) and reported, before that, three
  `phase-02-slice-09-r2-admission-dependency` deadline tests (they pass in isolation), the `a11y-structural/max-input` 2,000 ms budget test
  (fails in isolation under this load; no file of this lane is near it) and two `cms-publication-schedule-sweep-deadline` tests (another lane's
  file, in progress). The second attempt (excluding `cms-publication-schedule-sweep*`) passed 263 of 647 files with 0 failures before I stopped
  it to relieve the host (`green-worker-broad-partial.txt`).

## Left open / for the orchestrator

- Spec text: BE03b:1773's table row for `localeSources` and AC-113 still describe the older definition of "current"; the change log already
  carries DEC-170. Ledger entries for AC-113 should cite the new titles above. I edited no spec or ledger file.
- Design note for B-05: a poison outbox row ends `dispatched_at` set (the evidence is the `consumer_dead_letters` row, which carries the
  identifiers and reason). A dedicated outbox `dead_lettered_at` mark would be more literal but needs a new database function (the existing
  `dead_letter_unknown_outbox_event` refuses known event/version pairs); not done, as the finding asked for the relay to continue.
- The Worker still has no pre-deploy check that every undispatched historical row matches the envelope grammar (the finding's alternative);
  the poison rule makes it unnecessary.
- No new patterns, decisions or blockers needing a raw memory record beyond DEC-170 (orchestrator's).
