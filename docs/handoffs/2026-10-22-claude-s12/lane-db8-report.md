# Lane `claude_s12_db8` report (wave 8: AC-085 waits at positions 1/3/4, AC-294, AC-277 locale and related)

## Status

GREEN for the scope built; PARTIAL against the whole brief only where a BOUNDARY below names a missing command. HEAD `85ab5ff0`. Five new pgTAP files on the race7 harness run
**101 / 101 ok, 5 files, exit 0** on the ALT stack, lane `none` (promoted migrations only; no WIP migration was needed and `supabase/migrations-wip/db8/` was not created). Final run
`alt-staged-none-024422-3317753`. No product defect was found: every behaviour under test conformed to BE03b / BE03c (no RED against the spec). No sub-agent was spawned; no
race module, Playwright run or canonical db command was run; no ledger, receipt, tracker, spec, promoted migration, shared helper or another lane's file was touched (all files below are new).

## Scope

Brief `briefs/gaps-wave8.md` section db8: (1) AC-085 waits observed at lock positions 3 and 4 (refute7 finding 4); (2) AC-294 per race7's plan (authority / visibility and exact
schema / default rechecked after waits, no lock lever, no late position 2); (3) AC-277 "locale source edit versus translation" and "related target unpublish". Method: dblink two-session
pgTAP; the command under test is the real `platform_api` function; the holder is a real command wherever one exists, else a raw lock owner (stated per scenario); the wait is observed in the live
lock manager (`pg_blocking_pids`) and the other lock positions are probed from a third session WHILE the command is blocked (`FOR UPDATE NOWAIT`: `55P03` held, `00000` free).

## Per-row outcome

| Criterion | Clause | Outcome | Identity (file : scenarios) |
| --- | --- | --- | --- |
| P2-S12-AC-085 | 1 "runs in one transaction that takes its locks in the Slice 12 lock order" | ADDITIONAL EVIDENCE (8 citable titles; the refute7 finding 4 gap closed) | `race8_activation_order.sql` W1 (blocked at position 1: 3, 4, 5 and the advisory lock free), W3 (blocked at the subject row: 1 held; 4, 5, advisory free), W3b (blocked at the lineage's ACTIVE row: 1 and the subject row held; 4, 5, advisory free), W4 (blocked at the content type version row: 1, 3 held; 5, advisory free) |
| P2-S12-AC-294 | 1 "Deterministic concurrent tests prove authority/visibility and exact schema/default are rechecked after waits, with no invisible/foreign definition lock lever or late position-2 acquisition." | BUILT (23 citable titles; one BOUNDARY on archived / unassigned targets) | `race8_entry_create.sql` A3 (target bumped while the create waits at position 2: uniform `VALIDATION_FAILED` at `/fields/{relation}`; positions 3 and 4 free while it waits; control success), A5 (concealed target + holder on its entry row: refused at once, identical to an absent id), A6 (two targets: ascending id order, both polarities, plus the caller's assignment rows), A4 (revocation in flight: `FORBIDDEN`, nothing written), A1 (schema activation in flight: `VALIDATION_FAILED` at `/contentTypeVersionId`, no entry / pin / record); `race8_entry_default.sql` D2 (retire of the exact default in flight, create already holds the target (2): `CONFLICT`) |
| P2-S12-AC-277 | 2, part "locale source edit versus translation," | BUILT (9 citable titles) | `race8_locale.sql` E1 (source edit holds, translation waits, `VERSION_MISMATCH`, retry commits pinned to the NEW source) and E2 (translation holds, source edit waits, `VERSION_MISMATCH`; retry commits and the fan-out appends the `stale` row with its stale field ids and its own event) |
| P2-S12-AC-277 | 2, part "related target unpublish," | BUILT (10 citable titles) | `race8_related.sql` U1 (unpublish in flight: the curation does not wait, pin stored; projection lists the target until the unpublish commits, then drops it, pin stays), U3 (the unpublishing writer owns the target entry row: curation observed blocked at position 2 while it owns the source row; commits the pin afterwards; projection excludes the target) |

Proposals (the `recite2` schema, with the refute7 verbatim split parts for AC-277 clause 2) are in `docs/handoffs/2026-10-22-claude-s12/recite8/db8-proposals.json`, generated from the final TAP by
title and the title's line in the entry `.sql` file (every cited title is a whole SQL string literal of its `.sql` entrypoint; none is computed; the harness / fixture / cleanup / "once the holder releases"
control titles are deliberately not cited, per the DROP classes of refute7). Per-file title uniqueness was checked.

## Files (all new; path, lines, SHA-256)

| Path | Lines | SHA-256 |
| --- | --- | --- |
| `supabase/tests/phase_02_slice_12_race8_activation_order.sql` (21 tests) | 153 | `b9d7e9177cb870d7e1f6976a4a87b6380b9424f1f1192c56f1b0316d9281c385` |
| `supabase/tests/phase_02_slice_12_race8_entry_create.sql` (34) | 208 | `1c962c189b5178077449ad2fce2cd8302b6f1317b980f83065a5e4029f7fad59` |
| `supabase/tests/phase_02_slice_12_race8_entry_default.sql` (10) | 87 | `4d9260afe90332aad575fa7114c92fe7f0ef28c2f2e2931f4078c1619e35b482` |
| `supabase/tests/phase_02_slice_12_race8_locale.sql` (17) | 125 | `48525bf8035a014e1c9398dde657d5ebe898084160633d08b6b60f1d44b6a61b` |
| `supabase/tests/phase_02_slice_12_race8_related.sql` (19) | 113 | `19974b6dc2a229b1a09ffec4ac560ccc7caf9529aba557ff2ebc4a4b37307467` |
| `supabase/tests/phase_02_slice_12_race8/010-activation-helpers.sqlinc` | 22 | `7c0ea83130aa8479a130f5a53d5145cf95725e55075a832db44e9db221b1595b` |
| `supabase/tests/phase_02_slice_12_race8/020-edtl-world.sqlinc` | 65 | `e208468883caec351279ea12e381d4ce717cf4fcda2f36f72759dffb02074b6e` |
| `supabase/tests/phase_02_slice_12_race8/025-many-relation-world.sqlinc` | 41 | `dd5e51a1924b0e486ee1b8b2b7b0fe1c49461cf564ac2c9acb4c57ddcfc61f93` |
| `supabase/tests/phase_02_slice_12_race8/030-create-helpers.sqlinc` | 16 | `60e210792e8e02e0d405a2966e517c06b19dfa497c7b07648510694890b8cef7` |
| `supabase/tests/phase_02_slice_12_race8/050-locale-world.sqlinc` | 53 | `10e4dab8a1bfabb7ffc297261996d1b177142204cd58a1ac7952e9ad490c07d3` |
| `supabase/tests/phase_02_slice_12_race8/060-locale-helpers.sqlinc` | 23 | `aa43a0d35748eeee82dd219a038178f19dfbe4a1462bdb941d000c4b4babf0a9` |
| `supabase/tests/phase_02_slice_12_race8/080-related-world.sqlinc` | 46 | `619b9939f553de9fb105ebd0d79f7aeb4478f8586af2686b7ca9e164f7378d8b` |
| `supabase/tests/phase_02_slice_12_race8/090-related-helpers.sqlinc` | 38 | `5110bf5f3fb7e9a192856d0f0cfd51af55fa33f8fdbba05066c72194b3d99c7b` |
| `supabase/tests/phase_02_slice_12_race8/README.md` | 38 | `2f6f7bb512ffe2b4294982448dcacba240bc522d29d39ec7c831c785ef83eb36` |
| `docs/handoffs/2026-10-22-claude-s12/recite8/db8-proposals.json` | 562 | `1f086053b0622206b853639c840e617f82945d4189158706c223dad74ed5df91` |
| `docs/handoffs/2026-10-22-claude-s12/recite8/db8-race8-final-run.tap` (copy of the final TAP) | 202 | `a96eddf6236d57fbbfd8a8c0c455a588ba154785bfe6480476a6515e96358508` |
| `docs/handoffs/2026-10-22-claude-s12/recite8/db8-race8-final-run.manifest` (staged migrations of the final run) | 571 | `7e992cfe261b9fc3187c98ba25314804d266b57ae0c744474e5d8cc01d46067b` |
| `docs/handoffs/2026-10-22-claude-s12/lane-db8-report.md` | this file | (see the final message) |

No existing file was edited, so there is no `orig-*.tar`. The race7 harness fragments are `\ir`-ed unchanged. Scratch (run scripts, run logs): `<scratchpad>/claude_s12_db8/`.

## Runs

All through the staged ALT runner, lane `none`, one run per deliberate change (never wrapped in `timeout`; the only `timeout` in my session bounded a wait on a PID in my own polling). Stamps are `alt-staged-none-<stamp>`.

| Stamp | Files | Result | Classification |
| --- | --- | --- | --- |
| 022435-3235041 | activation_order | 21 / 21 ok | first run GREEN (W1, W3, W3b, W4 at the expected positions) |
| 022914-3252055 | entry_create | 27 tests, 5 not ok | A3, A5, A4 GREEN at first observation. My errors: the fixture assertion expected `ok` where the receipt state is `00000`; A1 (successor activation) `INVALID_REQUEST` (cause found in the next runs) |
| 023044-3258651 | entry_create | 27, 5 not ok | same A1 cause; diag added; the version-state aggregate ordered by a column all world rows share (fixed) |
| 023220-3265297 | entry_create + entry_default | aborted at the world | harness: a syntax error of mine in a diag note (`-` on an untyped literal) |
| 023311-3269715 | entry_create + entry_default | 37 tests, 7 not ok | harness: the successor's reviewer decision answered `STEP_UP_REQUIRED` (reviewer `rev1` has the owner organisation as party but a self-party binding in the DEC-202 world; `rev3` is usable); default: the position 4 probe was wrong (the retire holds that row itself, see Observations) |
| 023453-3276781 | entry_create + entry_default + locale | 54 tests, 5 not ok (all A1) | default 10 ok, locale 17 ok. A1: `P0001:CONFLICT|MIGRATION_SOURCE_DRIFT`: my A3 control create left an entry of the bound content type, so the sealed zero-source plan drifted; the control now runs in a held transaction that is rolled back |
| 023757-3288662 | entry_create + related | 46 tests, 4 not ok | create: A1 GREEN (`VALIDATION_FAILED` at `/contentTypeVersionId`), only its fixture assertion named a stale state; related: the projection also lists derived candidates, so the assertions became membership of the pinned target |
| 023906-3293913 | all five (before A6) | 94 / 94 ok, exit 0 | GREEN, superseded by the final run (A6 and the D2 observation were added after it) |
| 024020-3299572 | entry_create (A6 added) | 34 tests, 5 not ok | my request: the A6 Idempotency-Key had 6 characters (the bound is 8) |
| 024157-3307031 | entry_create + entry_default | 45 tests, 5 not ok | same A6 key (not yet rebuilt); default: position 4 held before the create is sent, so the equality assertion was removed (observation kept as a diag) |
| 024327-3313432 | entry_create | 34 / 34 ok | A6 GREEN |
| **024422-3317753** | **all five** | **101 / 101 ok, exit 0** | **FINAL on the bytes listed above**: TAP `.lane-logs/alt-staged-none-024422-3317753.tap` SHA-256 `a96eddf6236d57fbbfd8a8c0c455a588ba154785bfe6480476a6515e96358508` (copy `recite8/db8-race8-final-run.tap`); manifest SHA-256 `7e992cfe261b9fc3187c98ba25314804d266b57ae0c744474e5d8cc01d46067b`; plans activation_order 21, entry_create 34, entry_default 10, locale 17, related 19; each file's cleanup diag shows `added_where=` and `missing_where=` empty |

Every earlier non-final run was a harness / fixture classification (none was a product RED): the product behaviour matched BE03b / BE03c at its first observation in every scenario.

## Test corrections

None. No existing oracle was read as wrong and none was touched.

## Spec citations

BE03c "Slice 12 lock order (DEC-157, DEC-180)" 1500-1530 (row CMS-03C-09; rules 1, 2, 3), governed activation steps 1490-1495 and the migration `20261014070400` (positions: 1 authority rows, 3 subject row then the lineage's active row then the dependency graph (4 the content type version rows), 5 the review row, the advisory lock last); BE03c concurrency tests 1816-1817 ("locale source edit versus translation, related target unpublish"), CMS-03C-04 route 166 ("CAS source/entry") and transaction 1698, source-change fan-out 1393 / 1579, CMS-03C-05 1700 and Public projection 1571; BE03b "Initial revision default template (CMS-03B-10, DEC-202)" ("complete all visible external relation-target locks at2, then ... default at3 ... After waits, re-read/recheck the exact requested schema and its stored default ... retired or blocked default -> 409 CONFLICT") and "Write-path lock order and authority fencing" table positions 0-5 and rules 1 (capability re-proved under the lock, a revocation committed first wins: 403 `FORBIDDEN`), 2 (a non-visible target is refused first with the uniform refusal and is not a lock lever; a target bumped between check and use is observed), 3 (a writer that waited and finds its version superseded: create `VALIDATION_FAILED` at `/contentTypeVersionId`). Tracker P2-S12-AC-085, AC-277, AC-294. Decisions DEC-157, DEC-180, DEC-185, DEC-202.

## Observations (no defect, no RED)

- **D2 / retire holds the bound content type version row.** While the real CMS-03C-09 `retire` of T1 is in flight, the bound content type version row (position 4) is already `55P03` BEFORE the create is sent (`# observation` diag in the TAP). So position 4 cannot be used to show "the create has not yet reached 4" in D2; the lock-order evidence for 2 before 3 before 4 is carried by A3 (waiting at 2: 3 and 4 free) and A6, and D2 asserts position 2 held by the create at the default's wait. The retire locking its bound types is not contradicted by the BE03c retire text (which says no activation GATES apply, not that no rows are locked).
- **eligibleCount counts pins regardless of publication** (`cms_related_eligible_count`: pins + derived), so U1 / U3 assert `eligibleCount` 1 for a pin whose target is being unpublished. This matches BE03c 1700 ("compute `eligibleCount`") and 1569; the unpublish filter lives in the CMS-03C-21 projection.
- **No `platform_api` unpublish command exists** (03b has `cms_publish_revision` and the schedule executor only). The unpublish in U1 / U3 is the real lineage producer `platform_private.cms_append_publication_lineage` (the producer of every publication row, which the Slice 11 helper suites call), run as the dblink session's own role inside a raw transaction; in U3 that transaction also owns the target entry row FOR UPDATE, which is what a 03b writer holds at its position 0. If a public unpublish command is added later these two scenarios should be re-pointed at it.

## Open items / BOUNDARY

1. **AC-294: a target ARCHIVED or UNASSIGNED between check and use (BE03b rule 2 names "archived, or unassigned").** No command in BE03b / BE03c archives an entry or removes an entry assignment (the entry lifecycle producer is a later slice; the only writers are hand-written updates guarded by triggers, and disabling a trigger is forbidden). Visibility / version recheck after a wait IS shown for a bumped target (A3: the pinned `expectedTargetVersion` decided after the lock), for a concealed target (A5) and for authority (A4). Needed: the spec names the archive / unassign command; then add it as the holder of A3 (same file, same shape).
2. **AC-277 other parts, unchanged from race7**: "linked pattern update versus local override" (no override-writing command named), "duplicate and out-of-order events" and "restore-epoch fencing" (no 03c-specific rule): owner readings still needed. Not attempted.
3. **AC-294 residual (not a BOUNDARY, optional follow-up)**: a default template that is SUPERSEDED while the create waits at position 3 should still be accepted and pinned exactly (BE03b: superseded defaults remain eligible, never the newest template). D2 covers retire only (a template successor activation needs a template lineage named by the world's own key). Position 3's lineage active row for the template and the Worker mapping of `CONFLICT` are outside this SQL lane.
4. **AC-085 residual**: the `schedule` action's schedule row, the dependency-graph rows other than the content type version row, and the order inside position 1 (binding, tenure, grant) are still not observed individually.

## Requests to root

1. **Apply the proposals by clause text** (`recite8/db8-proposals.json`): AC-085 c1 (+8 rows; the criterion is already verifiable on race7's rows, these close refute7 finding 4), AC-294 c1 (+23 rows; the clause could verify once the ledger is satisfied with the BOUNDARY 1 reading, or stay `partial` with that limitation text: "target archived or unassigned between check and use: no archive / unassign command exists"), AC-277 c2 after the refute7 verbatim split (parts "locale source edit versus translation," 9 rows and "related target unpublish," 10 rows). AC-277 stays `partial` (c0 part 2, c2 parts 3-5 per race7).
2. **Runtime for the canonical gate**: the five files together take about 13 s of test time (the reset dominates the run); none waits for real time. They are plain pgTAP files (`pnpm db:test` picks them up) and restore the database they commit to (`added_after_restore = 0`, `missing_after_restore = 0` in each file).
3. Races root must run: none new (no `*.race.mjs` written).
4. Please ask the refutation population to check in particular: A5's identity of the concealed and the absent outcome (no existence oracle), the weakest assertion of D2 (position 2 only), and the modelling of the unpublish in the related file (Observations 3).
