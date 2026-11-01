# Independent DELTA review: lane `claude_s12_locale` fix pass (after `review-locale.md` PARTIAL)

Reviewer: independent adversarial reviewer; did not author the lane. Static review plus the three allowed Vitest
files. Worktree HEAD `b16edb54a7a1b698ed8ca15b6085046d4270626e`. Inputs verified by SHA-256: lane report
`3eaeada2079dedefe527a971fe29926f8e80120b5f12ce091ec5b74872061b53`, final TAP `alt-staged-locale-122018-342319`
`0b61cc35055351f5f00655906cc647341a00167c6c15b1792a5583178757f901`, prior review `999475fb28ae2cc3…`, RED TAP
`alt-staged-locale-red-121049-299840` `0f3aec51b8d7b7594cfed13aa28837b4bfbc393bc49b42272f5bfcfee467dd45`.
Read in full: the eleven WIP migrations, the variant/resolution/gate/perf entry files and all fragments, the diffs of
the nine edited pgTAP suites and seven TypeScript files, the installed sources they amend (20260927450000,
20261002167000, 20261010164000, 20261010164100, 20261002184000, the last definers of the four revision writers),
BE03c 185-192, 1387-1399, 1431, the tracker rows AC233-241/260, and every Worker/Web/apispec reader of the locale event.

## Status
Complete. VERDICT at the end.

## Delta verdict per ruling
- **F1 `cms_locale_variant` — in-claim work correct, consumer proof holds, but the Worker relay tests and the
  root-run apispec were missed (D1-D3).** Every emitter in `supabase/migrations` is replaced: 20261002167000:309 by
  050200 anchor 4 (`:78-80`, aggregate id `cms_locale_aggregate_id`, version `next_variant_version`),
  20260927450000:95 by 050300:107-110; 20261005010900:77 calls the replaced function. 050800:27-29 adds the exact
  tuple (no regex) and keeps the old one. Contracts `review-recheck.ts:67` + `[P2-S12-AC-237]` (admits the new
  token, refuses `cms_content_entry`, the dotted form and the plural); worker test-support `:32` feeds
  `source-consumers.test.ts:52-83` (ack, one job, `deadLetter.records == []`). The SQL resolver reads
  `payload.{entryId,locale,revisionId}` only (20261010164100:147-158). Variant 004:25-49 reads the grammar from the
  deployed dead-letter CHECK (non-vacuous). `recheck_relay.sql:53`: the old control asserted the UNDERSCORE token was
  unclaimed under the Slice 11 tuple; it never asserted the dotted form is rejected, and `cms_locale` stays outside the
  exact tuple set — not a weakened guard. Also: the HEAD worker test already named `cms_locale_variant`
  (`async-runtime-review-recheck-claim.test.ts:72`) — it corroborates the ruling, and is now inverted (D1).
- **F2 — correct and proven.** `preflight.ts:156-165` equals 050700:83-89 (`cms.locale.no_fallback_gate@1/database/-`,
  registry version 2); `registryVersion: '1' | '2'`; `cmsPreflightFailedReasons('locale')` is the three tokens, so
  `PreflightRefusalEntrySchema` admits a gate refusal (test `[P2-S12-AC-241]`, 422 not 500) and refuses
  `provider_unbuilt_reference` for `locale`. TS `ownerSlice '03c'` vs SQL `'slice-12'` mirrors the seed's own split
  (20261005017060:138) — no finding. My run: parity + preflight + review-recheck tests, 3 files / 59 pass.
- **F3 — exact by construction and proven through production `cms_create_revision`.** 050310 drops the installed
  trigger/function (guarded, 20260927450000:111-125) and attaches `AFTER UPDATE OF current_draft_revision_id … FOR
  EACH ROW WHEN (new not null and old is distinct from new)`; the verify block pins ROW/AFTER/UPDATE/immediate.
  Write order in the last definers: `cms_create_revision` 20261005018045:520→533/552→564/594→608,
  `cms_resolve_conflict` 20261005018050:571→585/621→634/658→672, `cms_restore_revision` 20261005018055:405→418→433→458
  (revision, values, relations, head). `cms_create_entry` 20261005018040:330→342(head)→356(values) moves the head
  before its values — harmless: no variant can exist for a new entry, the loop at 050300:62-69 finds none. Draft-head
  writers in `supabase/migrations` (grep `set current_draft_revision_id`): only these four families; the governed
  migrations touch none; revision inserters are exactly the five that 005:45-52 pins. `cms_author_locale_variant`
  never moves the head, so 050200:84-85 calls the fan-out after the value loop and before the variant row (005:66-74).
  050300:84-88 is the same predicate as 050100:107-110 over the latest variant and latest source, so the stored
  column equals the live truth; RED run: #66, #69, #70, #73, #74 red without 050310 (#72 red for the disclosed
  harness reason); GREEN run 11 #58, #66, #69-70, #73-75, #91-97. Through `platform_api.cms_create_revision`
  (002:264-293) the stored column is `[date]`, never the unchanged title, and equals `cms_locale_stale_fields`. The
  deferred-trigger rejection is sound (pending trigger events on ALTER TABLE; commit-time error past the wrappers).
  Residual exposure unchanged: a head move outside the RPC context raises `DIRECT_CMS_TABLE_WRITE` (050300:41-43),
  as the retired revision trigger did.
- **F4 — described accurately.** 050600:61-69: missing wins over stale over approval; approval only in
  `schedule`/`publish`, only for a revision a variant row names, fails unless E2 ∈ {approved, published}; `submit` and
  `execute` never check. 050400:30 maps `scheduled` → `approved`, so the two functions disagree at `scheduled`, as
  the report says. The three owner options are fairly stated; the prior review's recommendation (B) stands.
- **AC233 `[]` clause — added, non-vacuous.** 003:98-147: `[]` accepted for en-US sourced from a fr-FR revision
  (rolled back), `["fr-FR"]` → `FALLBACK_CHAIN_MISMATCH` with `activeFallbackChain []`, `[]` for fr-FR refused with
  `["en-US"]`, committed state unchanged. Successor-chain clause still open (disclosed).
- **Minors — done.** `plan(97)/(41)/(36)/(10)` (TAP `1..97` etc., 0 `not ok`); perf moved to its own suite with the
  quiet-host rationale (`locale_perf.sql:1-5`); idempotency counts in 003:10 and 002:64; equality on the stored column
  at 002:154-158; the AC276 textual lock pin is stated. Worker test-file sizes untouched (pre-existing, disclosed).

## Findings
Format: `file:line — severity — problem — why it matters — fix direction`.

### D1 — `apps/worker/src/async-runtime-review-recheck-claim.test.ts:71-80` — major — a now-red Worker test outside the author's Vitest scope
- The "aggregate other than the producer uses" example for `cms.localization.changed.v1` is `cms_locale_variant`.
  `parseOutboxClaim` (`apps/worker/src/async-runtime-parsing.ts:168-169, 195-204`) validates the six recheck claims
  with `ReviewRecheckSourceEnvelopeSchema`, whose localization member is the contract literal the lane changed, so the
  row now parses and `toBeNull()` fails. The file is unchanged (`git diff` empty). The report's "320 files / 4,403"
  names its scope (contracts, web workflow, worker editorial, parity); `apps/worker/src/async-runtime-*.test.ts` is
  outside it, so this red was never run.
- Fix: make the wrong-aggregate example `cms_content_entry` (it then also pins that the former aggregate is refused at
  the relay); the positive `it.each(SOURCES)` at `:33-53` already follows `AGGREGATE_FOR`.

### D2 — `apps/worker/src/async-runtime-outbox-poison.test.ts:73-78` — major — two now-red tests for the same reason
- `validLocalization(n)` builds the "valid" row under `cms_content_entry`; `:143-160` expects `send:${id(4)}` and
  `:299-307` expects `send:${id(2)}`. The same parse now refuses the row, so the sweep dead-letters and completes it
  instead of sending. (`poisonLocalization` and the echo at `:176-184` stay correct: the dead letter echoes the raw row.)
- Fix: build both localization rows with `AGGREGATE_FOR['cms.localization.changed.v1']`; keep one `cms_content_entry`
  row as an explicit poison case if the former aggregate's dead-letter path is worth pinning.

### D3 — root-run `pnpm db:api-test` (`vitest.postgrest.config.ts`) — major — four statically certain breaks at promotion, none listed by the author
- (a) `tests/postgrest/support/phase-02-slice-11-recheck-fixtures.ts:82-88` inserts `cms_locale_variants` with
  `state 'approved'`: 050000:93-94 restricts the state to `draft|stale`, so the whole Slice 11 recheck apispec fixture
  aborts (the lane made exactly this correction in `recheck_locale_source.sql:70` and `fanout_branch.sql:72`).
- (b) `:120-136` `editedSourceFixture` inserts a raw source revision with no values and no head move; after 050310
  nothing fans out, so `phase-02-slice-11-recheck.apispec.ts:450-462` (`stale = 1`, event id) fails. Fix as in
  `recheck_locale_source.sql:117-120` (`cms_stale_locale_dependents(edited, false)`) or move the head.
- (c) `phase-02-slice-11-recheck.apispec.ts:477-478` pins `aggregateType 'cms_content_entry'`, `aggregateId entryId`;
  the relayed envelope is now `cms_locale_variant` with the UUIDv5 id.
- (d) `tests/postgrest/phase-02-slice-12-locale-variant.apispec.ts:124-126` counts the event by
  `aggregate_id = entryId`, now 0; filter by `payload->>'entryId'` as the lane did in its pgTAP suites.
- Why it matters: these are the canonical E2E of the recheck relay/consumer; the lane cannot run them, but they go red
  the moment 050000/050200/050300/050310 are promoted. Fix: land the four edits in the same promotion.

### D4 — `20261014050800_cms_relay_locale_variant_aggregate.sql:10-11`; report fix-pass request 4 — minor — "still drain" is inexact
- Legacy `cms_content_entry` rows are still claimed, but `parseOutboxClaim` now refuses them, so they drain into the
  relay's poison path (dead letter `INVALID_QUEUE_PAYLOAD` + complete), never into the consumer. None exist on a
  fresh database. Say so; AC248's narrowing can drop the tuple once staging's dead-letter count is checked.

### D5 — `20261014050300_cms_stale_locale_dependents_slice12.sql:21-24` — minor — `p_backfill` is now dead
- The event version is `previous_row.version + 1` in both modes (D12), so the parameter has no effect. Keep the
  signature for its callers (20261005010900:77, the trigger) and say so in the comment, or retire it later.

### D6 — `tests/contracts/phase-02-slice-11-sql-parity.test.ts:200-209, 238-245` — minor — acceptable mirror, two notes
- `seedView` maps any version-2 row to a reference gate (generic), pinned to `['locale']` by `[P2-S12-AC-241]`; the test
  titled "seeds registry version 1 … for every row" now admits '2' for TS rows (the SQL seed regex still pins 1). The TS
  v2 row has no SQL parity check that runs today (D7). At promotion, add an assertion over the promoted 050700 text
  (`'locale', 'slice-12', 'cms.locale.no_fallback_gate', 1, 'database', null`).

### D7 — `phase_02_slice_11_helpers_preflight.sql:173, 477-479`; `phase_02_slice_11_criteria_publish_gates.sql:347-353` — minor — unproven, premise verified
- Both suites abort at `phase_02_slice_11_helpers/003-registry.sqlinc:55` (null `lifecycle_version` of
  `cms_pattern_versions`, made NOT NULL by the governed-lifecycle migrations) — baseline, not this lane. Statically:
  `h11w_revision` (`001-world.sqlinc:183-215`) writes an entry and a revision and no field value, so `gate-loc` fails
  `no_fallback_missing` under 050600:49-62; the `:173` string equals 050700:83-89; the executor delta set is unchanged
  because the gate is STABLE. Re-prove after the fixture repair.

### D8 — `supabase/tests/phase_02_slice_09_dec108/06-trigger-probes.sqlinc:70` — minor — stale inventory row, not a red
- The catalog passed 45/45 with the trigger dropped because `s09t_run_generic` probes only `cms_write_guard` /
  `cms_immutable_guard` rows. Baseline pass: drop `:70`, add `('cms_content_entries', 'cms_content_entries_locale_stale',
  'cms_content_entry_locale_stale_trigger', 17)` — tgtype 17 (ROW+AFTER+UPDATE), not the 29 the report names.

### D9 — `supabase/tests/phase_02_slice_11_recheck_relay.sql:31-33` — nit — stale comment ("the registry-key aggregate the Slice 12 events will use"); the `:53` control edit itself is correct.

## Ruling on the out-of-claim edits
Ratify all five: `review-recheck.ts:67` + its test and the worker test-support (the consumer proof F1 demands);
`tests/contracts/phase-02-slice-11-sql-parity.test.ts` (reads only the seed migration, so the TS v2 row needs the view;
minimal, pinned to `locale`); `apps/web/…/cms-workflow-labels.ts:75-79` (its suite `:48-55` iterates
`CMS_PREFLIGHT_REGISTRY.reasonCodes`, so the strings are required; FE03 specifies no copy for the three tokens, so the
wording is an implementation decision — neutral, no token echoed); `recheck_relay.sql:53` (see F1). The edits the
author did NOT make (D1-D3) are the ones that matter.

## Security (delta only)
050310's trigger function is SECURITY DEFINER of the CMS definer, `search_path` pinned, EXECUTE revoked from
PUBLIC/anon/authenticated/service_role (005:31-40); no new table grant. 050200 anchor 6 runs inside the author
command's own lock scope (entry `FOR UPDATE` already held). No PII or locale text enters the stale row, the event
(001:91-97) or the new contract test. Nothing else in the delta touches authZ, concealment or idempotency.

## Claims in the author's report re-verified
- TAP run 11: 74 files; variant 97/97, resolution 41/41, gate 36/36, perf 10/10; author_rpc 37, source_stale 15,
  stale_backfill 11, fix_locale_stale_field_ids 10, fanout_branch 15, fanout_regression 10, recheck_locale_source 32,
  recheck_relay 15, preflight_registry_schema 26, evidence_trigger_catalog 45 — all 0 `not ok`. Reds exactly as
  stated (r8 #4/13/14, sec2_all #6/12, sec2 #11 + deadlock abort `:490`, three `cms_pattern_versions` fixture aborts).
- RED run: 90 of 97 planned, 6 `not ok` (#66, #69-70, #72-74), 005 aborted on the missing function — as stated.
- Vitest: my allowed run, 3 files / 59 pass. The "320 files / 4,403" is scoped as the report says and excludes
  the two files of D1/D2, which are red by reading.
- Over-stated: "every … relay … suite passes" omits the Worker relay unit tests (D1/D2) and the apispec (D3);
  tgtype "29" (D8); "still drain" (D4). Hashes not re-verified (root instruction).

## Requests to root
1. Before promotion: edit D1, D2 (two Worker test files) and D3 a-d (three `tests/postgrest` files), then run
   `pnpm vitest run apps/worker/src/async-runtime-review-recheck-claim.test.ts apps/worker/src/async-runtime-outbox-poison.test.ts`
   and `pnpm db:api-test` on a quiet host. Production behaviour is right; these are stale oracles.
2. Ratify the five out-of-claim edits (above). Correct BE03c 388/1395 and the AC237 tracker row to `cms_locale_variant`.
3. Baseline pass: D7 re-proof, D8 inventory row (tgtype 17). Put F4 options A/B/C to the owner.
4. D4-D6, D9 at root's discretion; none gates promotion.

VERDICT: PARTIAL
