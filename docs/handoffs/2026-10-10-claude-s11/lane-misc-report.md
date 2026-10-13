# Slice 11 implementation lane "misc" report (2026-10-10)

Worktree `/home/rob/.codex/worktrees/phase2-slice11/WeJammin`, branch `claude/phase2-slice11`, HEAD `41a46135` at start and end (nothing
committed, staged, stashed or reset by this lane). Logs are under `.lane-logs/` of the worktree (paths below). Heavy commands ran under the
shared `/tmp/wejammin-quiet.lock`; the alt stack ran every pgTAP file. Only one production file changed (the evaluator migration, item 6);
items 1-5 and 7 close evidence or structure gaps over behaviour that already exists, so their proof is mutation, not RED-then-fix.

## Files

| File | State | Item |
|---|---|---|
| `apps/worker/src/cms-editorial/workflow-read-breach.test-support.ts` (162) | new | 1 |
| `apps/worker/src/cms-editorial/workflow-read-breach-workflow.test.ts` (232), `-review.test.ts` (223), `-queue.test.ts` (90) | new | 1 |
| `supabase/tests/phase_02_slice_11_read_hint_author_publisher.sql` (157) | new | 2 |
| `apps/web/src/pages/app/cms-content-modeling/reviews/review-detail-route.test.tsx`, `review-queue-route.test.tsx` | +1 test each | 3 |
| `apps/web/src/components/cms-editorial-workflow/CmsEditorialScheduleForm.tsx` | 308 -> 171 lines | 4 |
| `.../CmsEditorialScheduleFields.tsx` (122), `.../cms-workflow-schedule-form-model.ts` (126) | new | 4 |
| `tests/contracts/phase-02-slice-11-tzdb-pin.test.ts` | edited (213) | 5 |
| `tests/contracts/phase-02-slice-11-tzdb-pin-fixtures.ts` (88) | new | 5 |
| `supabase/migrations/20261005017570_cms_preflight_evaluation.sql` | edited in place (S11-only, not on `main`, not MD5-pinned) | 6 |
| `supabase/tests/phase_02_slice_11_helpers_preflight.sql` | +3 tests, `plan(162)` -> `plan(165)` | 6 |
| `supabase/tests/phase_02_slice_11_races/README.md` | 010 row; prettier re-padded the table | 7 |

Ownership note: `workflow-read-breach.test-support.ts` does not match the assigned glob `workflow-read-breach*.test.ts`; it is the shared driver
(a `*.test-support.ts` like every other Slice 11 support file) so the 50 cases are not copied three times. Rename or move if you prefer.

## Item 1 (AC-050, AC-053, AC-056; also AC-059 and the CMS-03B-17 page bounds)

Three suites, 50 tests, one per breach, each driving the REAL Hono routes over a fake port that answers a success payload derived from the
accepted fixture. Per case the helper (`expectRefused`) first asks the strict contract which member the payload breaks and requires that member
(a path prefix; a second prefix only where the same defect necessarily breaks a projected twin, e.g. manifest and version set), then requires:
the port was called once; the status; no `ETag`; `Cache-Control: no-store`; `X-Cms-Editorial-Retryable`; the `ApiError` code; no string of 12+
characters of the payload (ids, hashes, labels, instants) anywhere in the body; no `preparation`/`decisions`/`items`/`assignments` member name in
the body; and the telemetry event carries the same status and code and NO `*_returned` or `cms_preflight_*` metric (a refused payload is never
counted as served). Each suite also serves the inclusive bound (control), so the bound is exact, not off by one.

**The ruling is one token**: `RESPONSE_BOUND_STATUS: 502 | 422 = 502` in `workflow-read-breach.test-support.ts`, selecting the matching row of
`ENVELOPE` (`502` -> `BAD_GATEWAY`, retryable header `false`; `422` -> `VALIDATION_FAILED`, header absent). The current 502 is BE00:590/585.
If the owner rules 422, flip that token and the 20 refusals per suite go red until `registerWorkflowRead` maps the breach (proved below).

Tests (titles prefixed `CMS-03B-15 response bounds are refused, never served [P2-S11-AC-050] [P2-S11-AC-053] > refuses ...`):
a preparation for a revision that is not a draft; ... for a draft that is not the current draft; ... whose frozen hash is not the revision content
hash; ... whose risk class is not the workflow policy class; 18 preflight results; 16 preflight results; 17 preflight results in another order than
the registry; 17 schedules; 65 publications; 7 permitted next actions; a dependencyManifest whose blocks are out of canonical order / whose schema
artifact binds another schema version / with a member the contract does not name / with 129 blocks; a versionSet that is not the projection of the
dependencyManifest / with a member the contract does not name / whose block ids are out of canonical order; a latest review of another revision;
controls `serves 16 schedules and 64 publications...`, `serves a revision that is not a draft with no preparation and its own latest review`.
`CMS-03B-16 response bounds ... [P2-S11-AC-056] [P2-S11-AC-059]`: invalidatedReason without invalidated; invalidated with no reason; decidedAt on an
open review; approved with no decidedAt; recorded > required; protected requiring < 2; required count != policy count; risk class != policy class;
9 decisions; 33 assignments; a decision with an unnamed member; a decision reason on a decision that is not the caller's; two `mine`; duplicate
decision ids; fewer decision rows than recorded; more qualifying approvals than approve decisions; an assignment naming a person; duplicate
assignment ids; 6 permitted next actions; a frozen candidate restating another hash; controls `8 decisions and 32 assignments`, `a protected review
requiring 2 decisions with one recorded`. `CMS-03B-17 page bounds ... [P2-S11-AC-061]`: 51 rows; a 513-character cursor; rows out of keyset order;
recorded > required row; protected row with required 1; a row with an unnamed member; no `pageVersion`; control `50 rows and a 512 character cursor`.

GREEN: `.lane-logs/misc-worker-breach-GREEN-final.log` - `Test Files 3 passed (3)`, `Tests 50 passed (50)`.
Mutation (no production edit; scratch copies deleted):
- strict response parse removed (`vi.mock` of `parsedResource` as identity): `.lane-logs/misc-worker-breach-mutant-strict-parse-removed.log`,
  `44 failed | 6 passed` (`expected 200 to be 502`); the 6 survivors are the 5 inclusive-bound controls and `51 rows`, which `accept()` also refuses.
- token flipped to 422: `.lane-logs/misc-worker-breach-mutant-status-422.log`, 20 of 22 review-suite tests fail (`expected 502 to be 422`), the 2 controls pass.

Left open: the owner's 502-vs-422 ruling (see `lane-worker-report.md` item 1 options A/B/C). No production Worker file was touched.

## Item 2 (SQL finding 12 / FE open item 2): author who also holds `cms.publisher`

`supabase/tests/phase_02_slice_11_read_hint_author_publisher.sql`: 19 TAP tests (9 from the shared world fragments, 10 mine; titles tagged
`[P2-S11-AC-051|054|057]`). Four entries, each with an approved review, read as the publisher `pub`: `ah-ap` (revision authored by `pub`), `ah-na`
(authored by another human), `ah-as` / `ah-ns` (the same with a pending publish schedule, so the revision is `scheduled`). Asserted, from both
reads, `cms_get_editorial_review` (CMS-03B-16) and `cms_get_entry_workflow` (CMS-03B-15):

| Revision | CMS-03B-16 `permittedNextActions` | CMS-03B-15 `permittedNextActions` |
|---|---|---|
| approved, `pub` is the author | `["schedule"]` (no `publish`) | `["schedule","preview"]` |
| approved, other author (control) | `["schedule","publish"]` | `["schedule","preview","publish"]` |
| scheduled, `pub` is the author | `[]` | `["preview"]` |
| scheduled, other author (control) | `["publish"]` | `["preview","publish"]` |

Plus: the two reads agree on the publishing actions for the same caller on all four revisions; neither response contains the publisher, reviewer,
editor, creator or any account id; the reads change no row, event, token, schedule or publication (`r11r_effects()` equal). `schedule` is what lets
the author schedule the non-publish actions (BE03b:268-270; E11; DEC-164).

GREEN: `.lane-logs/alt-tap-194340-3199340.tap` (13 files, 540 tests, PASS, includes this file and the neighbours `rpc_reads_review`,
`rpc_reads_workflow`). It passed on first run because the production hint is already right (`cms_review_next_actions` excludes the revision author
from `publish`); the earlier first run `.lane-logs/alt-tap-193551-3165150.tap` shows the same 19 tests ok and only a wrong `plan(10)` (fixed to 19).
Mutation (inside a rolled-back transaction of a scratch copy of the file, deleted afterwards): `cms_review_next_actions` re-created with the
revision-author exclusion of `publish` removed. `.lane-logs/alt-tap-194949-3223583.tap`: `Failed tests: 11, 13-14, 16, 18` of 19 - the review-read
author case, the review-read scheduled case, both workflow-read author cases and the agreement test fail; the four control cases and the
fixture/leak/effects tests stay ok. (Run log `.lane-logs/misc-db-green-and-mutant.log`.)

## Item 3 (AC-060 part 2)

`review-detail-route.test.tsx` and `review-queue-route.test.tsx` each gain `[P2-S11-AC-060] moves focus to the heading on navigation only: the page
hands its heading to the shell that loads the heading-focus script`. It reads the page source, `CmsEditorialDocument.astro` and
`lib/route-heading-focus.ts` and requires: the page composes `<CmsEditorialDocument ... heading={heading}`; the page has no `<script`; the shell loads
`<script src="../../lib/route-heading-focus.ts">`; the shell renders `<h1 id="page-title" tabindex="-1">{heading}</h1>`; the script targets
`const PAGE_HEADING_ID = 'page-title'` and `'astro:page-load'`. GREEN `.lane-logs/misc-web-routes-g1.log` (3 files, 17 tests, includes the existing
`revision-history-route.test.tsx`). Scratch check: removing `heading={heading}` from either page makes the regex fail; renaming the script in the
shell makes the shell assertion fail. No existing assertion changed.

## Item 4 (extensibility split)

`CmsEditorialScheduleForm.tsx` 308 -> 171 lines. `cms-workflow-schedule-form-model.ts` (React-free: `SCHEDULE_FIELD_IDS`, `AUDIENCE_HINT`,
`asDisambiguation`, `scheduleLocalErrors`, `scheduleSubmission`) and `CmsEditorialScheduleFields.tsx` (the controls, `errorOf`, the shared
"changed instant forgets earlier/later" setter). Same error order and sentences, same body/draft/ifMatch. No test edited:
`.lane-logs/misc-web-schedule-g2.log` (after the last tidy of the model) runs the whole `cms-editorial-workflow` directory plus `workflow-route.test`:
`34 passed (34)`, `365 passed (365)` (the schedule form's `.test`, `.choices.test`, `.focus.test`, the islands, axe, privacy; the first run
`misc-web-schedule-g1.log` was 33 files / 358 tests before the tidy); `route-heading-focus.test.ts` and `workflow-route.test`: 2 files, 8 tests
(`misc-web-workflow-route-g1.log`). `tsc -p apps/web/tsconfig.json --noEmit` exit 0 (`misc-tsc-web-g1.log`); `eslint --max-warnings=0` exit 0 on every
file I touched (`misc-eslint-g1.log`); prettier applied. The directory README (`apps/web/src/components/cms-editorial-workflow/README.md`, not mine)
does not list the two new files; add them if you want the module map complete.

## Item 5 (tzdb pin, no hidden skip)

The `it.skipIf(!existsSync('/usr/share/zoneinfo/America/New_York'))` is gone. `tests/contracts/phase-02-slice-11-tzdb-pin-fixtures.ts` commits the
3,552 bytes of the real `zic` TZif file of `America/New_York` (tz 2026e, the DEC-153 pin; host `+VERSION` read `2026e-dirty`) as base64, with its
SHA-256. Titles (the old title is kept; nothing the ledger cites changed):
- new `commits the exact bytes of the real TZif file the reader test parses` (length 3,552 and SHA-256 `e9ed07d7...8a95`);
- `reads a real TZif file down to offsets, transitions and the POSIX footer` (same title, now on the fixture): footer, initial offset -17,762, the
  offsets set, sorted times, and now the exact count 236 and first/last instants (was `> 100`);
- new `reads the very transitions, offsets and footer the pinned snapshot holds for the zone`: the first 175 parsed transitions and their offsets,
  the initial offset and the footer equal the pinned snapshot's `America/New_York` zone entry; the other 61 are the footer rule written to 2037.
That last test ties the fixture to the pinned 2026e snapshot, which is the "derived from the snapshot" proof; the bytes are a real `zic` output, not
produced by test code, so the reader is checked against bytes it did not write. GREEN `.lane-logs/misc-tzdb-pin-g1.log` (10 passed); mutation (one
byte of the fixture flipped, restored and `cmp`-verified): `.lane-logs/misc-tzdb-pin-mutant-fixture-byte-flipped.log`, 3 failed (the three tests
above). `grep skipIf|it.skip|runIf` over `tests/contracts/phase-02-slice-11-*.test.ts` and the breach suites: none.

## Item 6 (`cms_evaluate_preflight` fail-closed branch)

RED first: `phase_02_slice_11_helpers_preflight.sql` gained, after the "control: registry version 2 that still names provider version 1" case, a
test-only `pattern` registry row at version 2, `provider_key preflight.pattern`, version 1, kind `database` (the registry constraints and guards allow
it: newer than the seed, key/kind/category checks hold; it is inserted and deleted with the same raw helpers the neighbouring cases use, all inside
the rolled-back test transaction). Tests:
- `a database registry row with no implementation in the evaluator (preflight.pattern at version 1) fails closed with INTERNAL_ERROR in the submit phase, never a silent pass [P2-S11-AC-093]`
- `and in the publish phase: the dispatch gap is a registry/evaluator drift, not a property of the phase [P2-S11-AC-093]`
- `control: with the unimplemented row removed the same request evaluates and passes again [P2-S11-AC-093]`

RED `.lane-logs/alt-tap-193551-3165150.tap` (run log `misc-red-pgtap-20261010-193551.log`, migration unmodified at that reset):
`not ok 99 ... have: 00000 want: P0001:INTERNAL_ERROR`, same for 100 (the evaluator reported the category as silently passed); 101 ok.
Fix: a final `else raise exception 'INTERNAL_ERROR' using errcode = 'P0001';` on the category dispatch chain (after `revocation`), with the header and
`comment on function` updated. Every one of the seventeen current rows still has its branch (10 database categories, 6 reference gates, the worker
checker), so no seeded row can reach it; a future slice that registers `preflight.<category>` v1 for a gated category must extend the evaluator, and
until it does it fails closed. Owner, `SECURITY DEFINER`, `search_path = ''`, grants, signature and volatility untouched (body and comments only).
GREEN `.lane-logs/alt-tap-194340-3199340.tap`: tests 99-101 ok, 13 files / 540 tests PASS, 0 `not ok`; the 13 are `helpers_preflight` (165),
`read_hint_author_publisher` (19), `rpc_reads_review`, `rpc_reads_workflow`, `rpc_review_submit`, `criteria_publish_gates`,
`rpc_publication_lock_order`, `slice_09_p240_a03_relation`, `preflight_registry_schema`, `slice_09_sec2_definer_rls`,
`slice_09_sec2_all_schema_definer_rls`, `slice_10_ev_eb_publication_scope`, `slice_11_schema_posture` (every suite that calls the evaluator or pins
the Slice 11 private function list). Contract neighbours `phase-02-slice-11-sql-parity`, `-runbook`, `-tzdb-pin`: 3 files, 37 tests passed
(`misc-contracts-g1.log`).

## Item 7 (races README)

The `010-review-assignment-race.mjs` row now states: A2 parks both creates behind a session holding the review row `FOR UPDATE` and observes, before
the release, that each waits only on the holder or the other and that neither has taken a write lock on the assignments table (the command's own
review lock, not the insert guard, serializes them); A5 (a create blocked behind an uncommitted revocation of the owner's `cms.editor` grant is
`capability_missing` once it commits, nothing reserved, the same key succeeds after restore); A6 (a revoke blocked behind an uncommitted end of the
owner's membership tenure is concealed `NOT_FOUND`, assignment still active); A7 control (a revoke blocked behind the loss of `cms.editor` still
commits). `prettier --write` re-padded the other rows of the table (whitespace only).

## Changed or replaced tests

No existing test was edited or weakened. Added/changed titles are listed above. The only existing title that now has a different body is
`reads a real TZif file down to offsets, transitions and the POSIX footer` (same title; reads the committed fixture instead of the host file; `times.length > 100`
became exactly 236).

## For the ledger lane

New titles to cite: item 1 (50 titles above, files `apps/worker/src/cms-editorial/workflow-read-breach-{workflow,review,queue}.test.ts`; AC-050/053/056 stay
partial until the 502-vs-422 ruling because the criteria text says 422), item 2 (`supabase/tests/phase_02_slice_11_read_hint_author_publisher.sql`,
AC-051/054/055/057), item 3 (the two `[P2-S11-AC-060] moves focus to the heading on navigation only...` titles), item 6 (the three preflight titles).

## Open

1. AC-050/053/056 still need the owner's 502-vs-422 ruling and the matching wording amendment (BE03b 285/290/292/300, matrix 1907-1909).
2. `FE03:1097` still reads as a blanket exclusion of the revision author for CMS-03B-07 (FE lane open item 1); item 2's pgTAP is the database proof of
   the BE03b rule, not an FE03 edit.
3. `tsc -p apps/worker/tsconfig.json --noEmit` reports 43 errors, all in other lanes' in-progress files (`review-recheck/*`, `async-entrypoint.ts`,
   `async-runtime-parsing.ts`, `a11y-structural/purity.test.ts`: contracts exports not yet built); none in a file of this lane.
4. Completion checklist: no new pattern, decision or blocker beyond item 1 (a pending owner decision); progress-tracker and session-close updates
   are the orchestrator's.
