# Independent review — lane `claude_s12_placement_sql` (CMS-03C-02 `cms_insert_pattern_instance`)

Reviewer: independent, static only (no DB, no tests run), read-only except this file. Worktree HEAD
`b16edb54a7a1b698ed8ca15b6085046d4270626e`, branch `claude/phase2-slice12` (confirmed).
Target report `docs/handoffs/2026-10-14-claude-s12/lane-placement-report.md`, SHA-256
`90e95c956e790f49fac555e8f3bd8af8a8f5843a6383aa24e8295220e584ee42` (confirmed). Per instruction, file hashes were
not re-hashed; line counts were: migrations 54/81/113/107/289/63 (all < 300), tests 45–217, witness 112 (all < 400).
Run 6 TAP `.lane-logs/alt-staged-governed-b+placement-171818-1555658.tap`: SHA matches the report, `ok`=539,
`not ok`=0, plans `1..516` + `1..23` — the 539/539 claim stands as a log fact (not re-executed).

## Status
Complete. No blocker. One undeclared spec ambiguity (F1) and the three declared open items need root rulings
before promotion; the rest are minor test/coverage corrections. Verdict at the end.

## 1. Route-registry clause map (BE03c :160, :375–378, :1336, :1365; contracts `pattern-instance.ts`)
| Clause | Implemented | Tested |
| --- | --- | --- |
| 201 `PatternPlacementResource` = exactly `{ items }`, 1–512 rows | 110300:188–214, 110400:40 | 010 `s12pl_check` (keys = `[items]`, n rows), 060:16–25 (512) |
| Decoded response ≤ 1 MiB (DEC-189) | producer-side none; transport guard only | 060:32,52 (compact bytes) — see F2 |
| Assigned author/editor on current draft, DEC-176, effective state draft | 110300:85–89, 105–108 | 050 visible-no-edit, rv-after, old-/submitted-revision, archived-entry |
| Hidden target 404 / visible-no-edit 403 | 110300:77, 80–83, 128 / 86–89 | 050 hidden-owner, unknown-revision, unknown-pattern / visible-no-edit |
| Idempotency key + If-Match = expectedVersion, replay, mismatch | 110200:47–53; 110300:91–97, 234 | 050 ifmatch-differs, short-idempotency; 040:36–44 |
| CAS on entry aggregate version, +1, ETag = committed version | 110300:99–103, 216–219, 233; 110400:37–39 | 050 stale (DETAIL members); `s12pl_check` version+1 and header |
| Unique (revision, path), nothing written on any collision | 110300:164–173 + table UNIQUE(revision_id,path,version) | 050 cl-second, collide-on-last-root (count 1) |
| One row per block root after DEC-181 expansion, all-or-nothing | 110100 expander; 110250 plan; 110300:188–209 (one INSERT) | 040 p1, p2 (nested chain), 060 big |
| Consecutive positions after slot greatest of any state/version (DEC-185) | 110300:180–185, 206 | 040 p1 (13 after retired 12), p3, p4, p6b, slot sequence :77–82; 060 int32 bound |
| Row path = slotPath + key chain, `/` adds no separator, ≤ 248 octets (DEC-186) | 110250:48–55; 110300:169, 198 | 040 p2, p4; 050 path-248/249/249-octets/247-octets |
| Overrides: 64 keys, depth 8, node-path grammar, must name a node, reference key refused, stored under owning root | 110200:90–99; 110250:56–62; 110300:201–205 | 050 overrides-*, override-ghost/at-reference/missing-child/without-chain; 060 overrides-65; 040:14–21, 52–57 |
| Digest recomputed; client digest equality only; malformed 422, differing 409 | 110300:154–157; 110200:84–88 | 050 digest-malformed/-uppercase/-mismatch |
| `pattern_version_not_active`, `pattern_incompatible`, `nested_pattern_not_active` | 110300:126, 141, 147; 110100:58–60 | 050 draft-pattern, absent-version, incompatible-type; 070 superseded-version, nested-superseded |
| `pattern_cycle`, `pattern_depth_exceeded`, `pattern_nodes_exceeded`, zero roots | 110100:34–35, 61–63; 110250:42–47 | **none** — F3 |
| Lock order positions 0,1,3,4,5 (:1336 row) | 110300:78–79, 85, 131–138, 150–151, 176–178 | sequential only; concurrency undeclared-untestable here (race module) |
| Rule 2 pinned definition re-read under lock | 110300:139–142 | 070 superseded-version (sequential form) |
| Rule 4 deadlock/lock failure → CONFLICT, reservation rolled back | 110400:30–35 | none (declared; race module) |
| AC-219 live review invalidated `dependency_changed`, revision hash unchanged | 110300:221–229 | 040 p7 :89–105; `s12pl_check` revision row unchanged |
| Event none; one audit record | no `cms_emit_event`; 110300:230–232 | 040:31–33, p7 outbox +1 (review-changed only); `s12pl_check` audit = 1 |
| Grants: definer-owned, service_role only, no PUBLIC | 110300:242–287; 110400:47–61 | 020 schema; 050 acl-anon/-authenticated (42501) |
| `CompositionInstanceResource` strict shape, D5 `contentHash` | 110250:70–92 | `s12pl_check` items = stored rows — see F10 |

## 2. Findings
F1 `supabase/migrations-wip/placement/20261014110300_cms_insert_pattern_instance.sql:110-117` — major — a
template-less entry accepts ANY normalized `slotPath` (`/main`, `/side`, `/fresh`, `/main/more` in 040; `/main` in
060), while BE03c :1365 and P2-S12-AC-218 say the slot path "must exist in the revision's template (or be a root path
when the entry has no template)". The natural reading of "a root path" is `/` (the only "root path" DEC-186 and :1365
define); the lane took the permissive reading without declaring it (B1 covers only the key name). Why it matters:
this is the route's primary admission rule and nearly every positive test encodes the permissive reading; if root rules
strictly, the suite's fixtures are the wrong shape, not just one assertion. Fix: add to R5 as an explicit ruling; if
strict, refuse `template_version_id is null and v_slot_path <> '/'` as 422 at `/slotPath` and move the slot cases of
040/050/060 onto the templated entry `tp`.

F2 `supabase/tests/phase_02_slice_12_pattern_placement/060-big.sqlinc:28-37,49-55` — minor — the 1 MiB assertions are
on a compact re-serialization, but the production adapter bounds the RAW PostgREST body
(`apps/worker/src/cms-editorial-production-transport.ts:161-171`, `readBoundedResponse(maxResponseBytes)`), which is
padded jsonb text (run-6 diag: 311,789 padded vs 295,405 compact for the maximum case; the worst case's padded size is
not even printed). The route re-checks compact (`pattern-instance-routes.ts:234`), so both quantities bind. Fix:
assert `padded_bytes <= 1048576` for both the maximum and the worst case (padded ≥ compact, strictly stronger).

F3 `20261014110100_cms_pattern_placement_nodes.sql:34-35,61-63`; `20261014110250_cms_pattern_placement_plan.sql:42-47`
— minor — four refusal branches (`pattern_depth_exceeded`, `pattern_cycle`, `pattern_nodes_exceeded`, zero roots)
have no test; the report's "not exercisable without forging a pattern row" is wrong: both functions take the forest /
a composite value as input, so a test can call `cms_pattern_placement_nodes(owner, forged_forest, array[pa_lineage])`
(cycle, draft nested, depth) and `cms_pattern_placement_plan(owner, jsonb_populate_record(row, '{"block_tree": ...}'),
…)` (513 roots) without inserting anything. BE03c :1612 names "cycle/depth/node rejection" for CMS-03C-02. Fix: add
these four sentinel refusals (exact token + DETAIL) or record them as definition-time guarantees with the
pattern-definition test that proves each.

F4 `040-positive.sqlinc:73-74` — minor — `p6` asserts only SQLSTATE `P0001`, not the token; every other refusal uses
`s12pl_refused` with the exact token. Fix: `s12pl_refused('p6', …, 'CONFLICT', '["/slotPath"]')`.

F5 `20261014110000_cms_composition_instance_position.sql:23-42` — minor (process) — the one-time backfill disables
`cms_composition_instances_write_guard` and `_immutable_guard`. Safety judged on a populated table: the immutable
guard raises unconditionally (`20260902080000:1623-1631`, no bypass GUC), so pausing it is the only route; the
`add column` at :21 holds ACCESS EXCLUSIVE to commit, so no concurrent writer can slip through the pause; both guards
are re-enabled in the same transaction; the only other trigger is `_target_revision_guard` (BEFORE INSERT only,
`20260927500000:51-53`), no `updated_at` trigger exists, and the CHECK `updated_at = created_at` is untouched; the
witness proves rank, NOT NULL, CHECK, index and `tgenabled = 'O'` on seven legacy rows. The write guard alone could
have been satisfied with `set_config('app.cms_rpc','true',true)` instead of a pause (equivalent here). Lane-rules
"Never disable triggers" conflicts literally; the lane disclosed (R4) but did not stop. Fix: root ratifies the pause at
promotion; add R3's parity contract test so the witness DDL cannot drift from the migration.

F6 `20261014110200_cms_pattern_placement_request.sql:79` with `20261014110300:110-117` — minor (part of B1) — because
`/` maps to slot key `root`, a templated entry ADMITS `/` whenever its template declares a slot literally named `root`
(same `slot_key`, shared position sequence with `/root/...` rows). :1365 allows a root path only "when the entry has
no template". Fix: refuse `/` on any templated entry regardless of slot names (one condition), and say so in B1.

F7 `20261014110300:105` — minor — an `archived` entry answers `revision_not_editable`; the closest precedent
(`20261014060400_cms_curate_related_content.sql`, CMS-03C-05) answers `INVALID_TRANSITION` for a non-active entry.
BE03c :375 is silent on entry lifecycle for CMS-03C-02; the chosen token is on the operation's closed list (:1304), so
this is acceptable but should be stated as a decision, not left implicit.

F8 — info (B2 verified) — no CMS-03C-02 row (:375–378), the Zod (:518), the narrative (:1365) or the data flow (:1504)
names `maxCount`/`allowedBlocks` at placement; IA03 has neither word; FE03 mentions `maxCount` only in the template
designer (:1790, :2466–2467). The only text that could bind is the generic control BE03c :1488 "enforce protected
depth/node/slot counts before save". "Silent" is accurate for the route; the ruling request must cite :1488.

F9 — info (B3 verified by construction) — a worst-case item (248-octet quote-escaped path ×2, 96-char block key,
16 keys, two 64-hex hashes, two ISO instants, uuids) is ≈1.1 KB; 512 × 1.1 KB ≈ 0.56 MiB, under 1 MiB even padded.
The over-budget refusal therefore exists only at the transport (adapter raw-byte bound; route :234). FE03 :1050 and
BE03c :1487 require "an over-budget refusal against the actual producer" — unsatisfiable as written; needs a spec
correction (ruling), not code. The 512-row maximum and the worst-case size are genuinely proven in 060.

F10 `010-oracles.sqlinc:110-128` — minor — `s12pl_resource` is a verbatim copy of `cms_composition_instance_resource`
(110250:78–91), so the suite's "independent D5 hash" is independent of the response builder only, not of the key set.
I cross-checked the key set against the real D5 in `20261005010400_cms_revision_comparison_domains.sql:877-891`
(`blockKey, blockVersion, blockRegistryDigest (btrim), mode, patternRef{patternId,patternVersion}, props, bindings`):
identical, so the hash is correct. Fix: cite :877 in the oracle comment and keep the two in a parity check, or derive the
expected hash from `cms_compare_revisions` output in a test.

F11 — info — spec testing line :1612 asks for forests of 1, 2 and 32 block roots; the suite has 2 (pa, pc2), 3 (pa2)
and 512 (pb) successful placements, none of exactly 1 or exactly 32. Minor coverage gap; add two placements.

F12 — info (claims re-verified) — test corrections: the overlong-case replacement is corroborated by
`docs/handoffs/2026-10-12-claude-s12/lane-codex-pattern-sql-red-report.md:73` (`/` + 250 `x`); the skeleton's
HTTP-code oracles were never committed and no prior report quotes them, so that claim is unverifiable; the replacement
tokens follow every promoted producer and :1304 ("VERSION_MISMATCH and CONFLICT are not application codes" — they are
SQL tokens the Worker maps), so the direction is right. D1/D2/F1-of-the-lane: the E2 helper is the one derivation
(`20261005017540`); the constructed live-review shape (older `submitted_at` open beside a newer invalidated) is
admitted by the one-live-review partial unique and is unreachable through the real submit producer (monotone
`submitted_at`), so p7 proves the code path, not a real-path effect — acceptable as defense in depth, as declared.
`cfg_correlation` never returns NULL (`20260901070000:505-507`), so the invalidation call at 110300:226 cannot raise
INVALID_REQUEST mid-placement. Lock positions, refusal order and replay-before-CAS match CMS-03C-05 exactly.
`conflictState` none/null (110250:91) is consistent with the contract enum and nullable; rows written `active` matches
:1426 ("appends an `active` row" for the comparable CMS-03C-15 accept) and the Worker's `validPlacement`.

F13 — info (requests to root re-verified) — R1 is already fixed by the untracked baseline-repair migration
`supabase/migrations/20261014130000_cms_dependency_manifest_pattern_version_pin.sql` (written 17:22, after run 6;
join becomes `pattern.pattern_id = instance.pattern_id and pattern.version = instance.pattern_version`) — R1 can be
closed. R2 is accurate: the closed token table `apps/worker/src/cms-editorial-production-error-tokens.ts` holds only
uppercase tokens; `codeFromRpcError` (`cms-editorial-production-errors.ts:139-152`) adopts a P0001 message only when it
is a key of that table, so every lowercase Slice 12 token falls to the status fallback; the hardening lane's
`pattern-instance-details.ts` maps `details.reasonCode` only after a status exists. Worker boundary untouched by this
lane (confirmed: no `M` on any `pattern-instance-*.ts` attributable to it; the lane's files are all `??`).

## 3. Security, conventions, tests
Security: actor before validation (UNAUTHENTICATED first), concealment before authority, authority re-proved under
position-1 locks before the idempotency reservation (matches CMS-03C-05), CAS detail carries versions only, DETAIL
pointers only, no PII, `search_path = ''`, definer-owned, private body executable by no app role (020 asserts PUBLIC
and service_role both absent), overrides bounded at request and by the table CHECK, int32 position bound explicit.
Conventions: shape, grants, error tokens, reservation/replay and `app.cms_rpc` restore match `20261014060400` and
`20261003120410`; all files under limits; no TODO/skip/any (swept). Tests: oracles are non-vacuous (exact SQLSTATE +
token + DETAIL + full before/after store images; a missing function is a captured 42883, never an abort), every pattern
is created and activated through the real governed chain, no trigger disabled in tests, fixtures are guarded inserts.
Concurrency clauses (two placements into one slot, deadlock→CONFLICT) are correctly declared out of reach here.

## 4. Requests to root
R-A rulings: F1 (template-less slot paths), B1+F6 (`root` key; `/` on templated entries), B2 citing :1488, B3/F9 as a
spec correction. R-B before promotion: F2, F3, F4 test fixes (small, no production change); F5 ratification and R3
parity test. R-C close R1 (fixed by 20261014130000); keep R2 for the Worker hardening lane.

VERDICT: PARTIAL
