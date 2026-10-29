# Review `claude_s12_refute4` - refutation of the wave-5 proposals (lanes `gaps-unit5`, `gaps-api5`)

Reviewer: `claude_s12_refute4` (separate population; I wrote none of the tests, product code or proposals). 2026-10-29. Worktree
`/home/rob/.codex/worktrees/phase2-slice12/WeJammin`, HEAD `cd89d54c` (gap-wave files untracked or modified).
Read: `briefs/recite4-refutation.md`, `briefs/recite3-refutation.md`, `2026-10-14-claude-s12/lane-rules.md`, `scripts/evidence/README.md` and
`ledger-guard-lib.mjs`, the current ledger `tests/contracts/phase-02-slice-12-evidence-ledger*.ts`, `recite4/unit5-proposals.json` (SHA-256 `b99cb31e...153d`),
`recite4/api5-proposals.json` (`92694a4c...`), `lane-gaps-unit5-report.md` (`788d6ad1...`), `lane-gaps-api5-report.md` (`80052964...`), DEC-226 / DEC-211 / DEC-199 / DEC-236 texts
(`.memory/raw/events`), BE03c / FE03 / BE00 lines quoted below, all 14 cited test files (SHA-256 of the unit5 files equal the lane report), the production Worker routes and
adapters they exercise, the migrations named in section 5, and api5's ALT TAP `.lane-logs/alt-staged-none-003647-1626501.tap` (`7ad94e4f...9ae`).
Output: `recite4/refutation.json` (15 entries, one per proposed criterion) and this report. Read-only: no supabase, docker, db, race, Vitest or Playwright run. The only
execution was `node` one-liners (Headers behaviour of control, DEL and non-ASCII values), the repository's own `evaluateLedger` on synthetic passing receipts (section 6) and
TAP parsing. Scratch (builders, ledger dumps, the guard simulations): `/tmp/claude-1000/-home-rob-Projects-WeJammin/2663dcb2-f742-450b-97cd-0e849cede6cc/scratchpad/claude_s12_refute4/`.

## 1. Verdict

**ACCEPT-WITH-DROPS (mandatory conditions).**

111 citations proposed (unit5 96 in 8 criteria, api5 15 in 3 criteria; four more criteria, AC-169, AC-271, AC-001, AC-211, propose none and only restate a
BOUNDARY or a PARTIAL). **96 KEEP (86.5 %), 8 DROP (7.2 %), 7 FIX (6.3 %).** DROP is above the 5 % ACCEPT band, so this is not a plain ACCEPT; it is not a REJECT either:
the proofs are specific and mutation-sensitive, the DROPs are single assertions (not a habit), and every clause the lanes closed keeps sound evidence. By lane: unit5 4 DROP of 96
(4.2 %), api5 4 DROP of 15 (26.7 %, all four the same adjacent frozen-status assertion).

Eight things stop a plain apply (mandatory conditions, detail in section 7):

1. **AC-010 row 0 is RED on a correct stack** (`conflictState: null` where the database answers `'none'`): FIX one token (finding 1).
2. **AC-272 cannot be applied as proposed**: c0 cited + `partial` + a limitation is rejected by the guard; split c0 or hold for web6 (finding 2).
3. **AC-039 and AC-134 close their clause on a subset**: 34 existing per-route key tests and 3 existing selector 502 tests must be cited too (findings 4, 5).
4. **AC-164 row 14 is blind** (DROP) and six rows belong to a different clause (FIX).
5. **AC-169 and AC-271 limitation texts contain wrong or soon-false statements** (findings 6, 7).
6. A passed receipt from root's PostgREST run for the two new apispecs (AC-010, AC-016); until then they stay uncited.
7. Add the six AC-238 seam guardrails to the eight KEEPs.
8. Rewrite the AC-042 and AC-164 limitations (they stay partial).

## 2. Counts

| Criterion | clause | lane | proposed | KEEP | DROP | FIX | lane status | my status |
|---|---|---|---|---|---|---|---|---|
| AC-039 | c2 Idempotency-Key 8-128 | unit5 | 27 | 27 | 0 | 0 | closed-clause | **verified** (with 34 added) |
| AC-095 | c2 body + mutation header | unit5 | 6 | 5 | 1 | 0 | closed-clause | **verified** |
| AC-126 | c3 "is 404" | unit5 | 2 | 2 | 0 | 0 | closed-clause | **verified** |
| AC-128 | c1, c2 | unit5 | 5 | 5 | 0 | 0 | closed-clause | **verified** |
| AC-134 | c4, c5 | unit5 | 4 | 4 | 0 | 0 | closed-clause | **verified** (with 3 added) |
| AC-169 | c10 | unit5 | 0 | - | - | - | partial (BOUNDARY) | partial (BOUNDARY accepted, limitation text corrected) |
| AC-042 | c12 scoped draft | unit5 | 28 | 27 | 1 | 0 | closed-clause | partial (c1, c5 uncited) |
| AC-164 | c4 session resource | unit5 | 16 | 9 | 1 | 6 | closed-clause | partial (c3, c6 uncited); 6 re-filed under c5 |
| AC-271 | c0 | unit5 | 0 | - | - | - | partial | partial |
| AC-272 | c0 privacy sweep | unit5 | 8 | 7 | 1 | 0 | partial | partial **only via a split** (as proposed: guard problem) |
| AC-001 | c3 accessibility | api5 | 0 | - | - | - | partial (BOUNDARY) | partial (root's reading, web6) |
| AC-211 | c1 again before publish | api5 | 0 | - | - | - | partial (BOUNDARY) | partial (one uncited clause, as ruled) |
| AC-010 | c2 happy path | api5 | 2 | 1 | 0 | 1 | verified-after-run | **verified** after the fix + a passed receipt |
| AC-016 | c1 happy path | api5 | 1 | 1 | 0 | 0 | verified-after-run | **verified** after a passed receipt |
| AC-238 | c3 graph compatibility | api5 | 12 | 8 | 4 | 0 | verified-if-accepted | **verified** (technique accepted) |
| **Total** | | | **111** | **96** | **8** | **7** | | |

DROP classes (the schema of the earlier rounds):

| Class | n | Where |
|---|---|---|
| ADJACENT: a neighbouring rule or mechanism | 5 | AC-238 the four `actual revision-aware frozen status` rows (`gaps_api5_pattern_compat.sql:108,113`, TAP ok 175, 186, 197, 208); AC-272 queue row (`governed-surface-privacy.test.ts` `CMS-03C-11 review queue`: no clause data in the payload) |
| CONTROL: a positive baseline filed as proof | 1 | AC-095 `governed-review-queue-no-body.test.ts:57-61` (plain queue is 200) |
| NOEFFECT: asserts a literal, observes nothing | 1 | AC-042 `CmsTemplateDesigner.unsaved.test.tsx:368-372` (the constant `CMS_TEMPLATE_NO_AUTOSAVE`) |
| BLIND: passes whether or not the rule exists | 1 | AC-164 `template-context-session-isolation.test.ts:34-46` |

FIX (7): AC-010 row 0 (wrong expected value); AC-164 rows 8-13 (sound, but they prove the next clause: re-file under c5, class ADJACENT for c4).

Ledger totals by the repository's own guard (section 6): now 229 verified / 64 partial / 3 unverified; with every verdict and condition applied **237 / 56 / 3**, 0 problems (AC-039, 095, 126, 128, 134, 238 on apply; AC-010 and AC-016 once their receipts pass).

## 3. The most serious findings

1. **AC-010 apispec row 0 is red on a correct implementation.** `tests/postgrest/phase-02-slice-12-pattern-placement.apispec.ts:109-118` asserts `conflictState: null` for every row of a linked placement.
   The database answers `'none'`: `cms_composition_instance_resource_hashed` (`20261024150300:31`) is `case link_mode when 'linked' then 'none' else null end`; the pgTAP oracle
   (`phase_02_slice_12_pattern_placement/010-oracles.sqlinc:138`) and every Worker fixture (`pattern-placement.test-support.ts:40`) say `'none'`; the Worker returns the strictly parsed
   rows unchanged (`cms-composition-production-pattern.ts:208-217`, schema enum `none | pending_diff` nullable). The test was never run (apispecs run only under root's PostgREST
   runner), so nobody saw it. FIX: `conflictState: 'none'` at :117. Everything else in the two rows checks out against the SQL: audit on `(v_items->0->>'id')`
   (`20261016040400:238-240`), positions from 0 and the root-slot path rule (BE03c 1530), state `active`, version 1, `entryVersion + 1` as the ETag. Row 1 (nested) asserts no
   `conflictState` and is fine.
2. **AC-272 as proposed is rejected by the guard.** The proposal cites c0 (c1 is already cited), states `partial` and a limitation. `ledger-guard-lib.mjs:214`:
   "partial entry: every clause is cited, so the entry is verified, not partial". Reproduced with the real `evaluateLedger` (section 6). The residual is real (the browser
   `CmsDiffPath` surface is not swept, web6 row 4 is on it), so the honest forms are either to **hold all eight until web6's browser sweep is KEPT and then mark verified**, or to
   **split c0** into three verbatim parts (given in the JSON, tiling verified) leaving `pattern diff values,` uncited and holding the Worker diff row with it. The seven other KEEPs
   carry `splitParts`.
3. **AC-164 row 14 is blind** (DROP). `template-context-session-isolation.test.ts:34-46` puts the "designer-capable caller" on `resolveSession`, but `GET /api/v1/auth/session`
   builds its body from `dependencies.readSession(resolved.value)` (`routes-session.ts:50-61`) and the harness `readSession` is `vi.fn(async () => success(resource))`
   (`phase-02-slice-01.test-support.ts:100`), which ignores its argument. The assertions compare the mock's constant with itself. `AuthenticationSession` has no capability
   member at all. The sibling row 15 (a widened reader is not served; strict parse) is sound and kept.
4. **AC-039 cites half of "All".** Twelve operations take a key (BE03c 150: CMS-03C-01..-09, -12, -15, -16); the 27 rows cover -06, -07, -08, -09, -12, -16. c0 and c1 of the same
   entry cite one test per operation (12 and 13 citations). The other six exist and pass (`write-header-order*.test.ts`, `pattern-update-order.test.ts`, plus the missing/short
   sides of -06, -07, -09, -12): **34 tests, exact identities in `missedTests`**, REQUIRED. The 27 themselves are sound: each deletes or replaces only the header of a request the
   same builder sends to a success elsewhere, asserts the exact `400 INVALID_REQUEST` and that neither quota nor port was reached, and the 8/128 acceptance rows are the clause
   (an accepted range), not controls.
5. **AC-134 c5 cites 503 and 504 but the clause says 502/503/504.** The selector's 502 tests exist and pass (`cms-composition-production-taxonomy-reads.test.ts:313-327`, three
   rows) and are uncited: REQUIRED, identities in `missedTests`. The 429 rows (`300` user, `600` party, `Retry-After`, `RateLimit-*`, port never called) and the 8,000 ms
   deadline (nothing at 7,990 ms, 504 at 8,010 ms) are exact against `TAXONOMY_RATES` and `TAXONOMY_RPC` (`taxonomy-rpc-table.ts`). The tests' comments cite BE03c 179 for
   CMS-03C-17; that line is CMS-03C-11, the selector row is 187 (values equal).
6. **AC-169 limitation text.** BOUNDARY accepted (section 4.3). But the text says the schedule "would exceed the 8,000 ms read ceiling (BE03c 1419)": 1419 is the CMS-03C-08 error row
   and `cmsTemplateLatestRead` is 15,000 ms (BE03c 170). It also says "the only server caller is the SSR page": the same-origin forwarder
   `pages/api/v1/cms/templates/[templateKey].ts:9` calls `readCmsTemplateDetail` too, and "no shared retry constant" omits `CONSUMER_RETRY_DELAYS_SECONDS`
   (`event-consumers/retry-schedule.ts`, used by jobs and consumers, none of which reads this route). A corrected text is in the JSON (`limitationAdvice`).
7. **AC-271 limitation text** describes three product files as still deviating ("`CmsTaxonomyVersionDesigner.tsx:108`, `CmsTaxonomyTermAction.tsx:121`, `CmsLocaleVariantForm.tsx:128`").
   Those files were modified at 00:55-01:04 today, after the unit5 report (web6 row 1 targets exactly these three), and the lines now read `disabled={designer.done}` and bare `<fieldset>`. A ledger limitation should say what no test proves
   (the seven states per island, the 250 ms skeleton at 249/250 ms), not the state of other lanes' product files. Shortened text in the JSON.
8. **AC-238: the raw-copy technique is accepted** (ruling in 4.1); four frozen-status rows are adjacent (DROP) and the six premise/setup assertions that make it a seam must be
   cited as guardrails.
9. **AC-272 residuals the lane did not name** (missedGaps): the 401 `STEP_UP_REQUIRED` detour (the decision `{decision, reason}` goes to the tab-scoped draft store and the person to
   `/step-up?returnTo=`) is the one path where a reason sits in storage next to a URL and the browser sweep drives only the success path; canonical ids are not in the browser
   sentinels; CMS-03C-09 activation is not swept at the Worker. And one reading for root (4.4): CMS-03C-08's 201 sets `Location: .../assignments/{assignmentId}`.
10. **AC-211 cross-criterion**: A238-direct-publish and A238-recursive-publish are the "compatibility" half of AC-211 c3 (whose citations PC-N03/N05/N06 are all active-state failures);
    listed as `missedTests` for c3. They do not close c1, which also names depth, nodes and cycle.

## 4. Rulings

### 4.1 Seam ruling - AC-238 `and satisfy the existing graph compatibility rule (DEC-199).`

Technique: a **draft** pattern row copied directly in the RPC context (`g2p_raw_copy`) with one patched member (`compatible_type_ids` = {type 1, type 2} over a nested child that
lists {type 1}), then taken through the **real** CMS-03C-06 submit, -08 assign, -07 decide, -09 activate and really placed through CMS-03C-02; the real manifest builder, frozen-status
wrapper and evaluator then run. Precedent: `gaps_pattern_governed` AC-200 (2b). **Accepted; KEEP the four outcome rows and the four guardrail controls.**

| Point | Ruling and evidence |
|---|---|
| (a) substitutes only the state under test | Yes. Nothing production is replaced, renamed or restored (the file runs in `begin ... rollback`). The inserted row is a draft, which the lineage guard demands of any insert (`20261014020200:23`), so no trigger is bypassed; the chain is real (setup ok 112/113, premises). The copy differs from its source in `compatible_type_ids` and in a synthetic `content_hash` and a fresh lineage, both of which the raw-copy control carries too. The submit gate checks only nested *activity* ("by construction, compatible and acyclic", `20261013300820...binding_fix.sql:154`), which is why the state is reachable only this way. |
| (b) every other disjunct shown false | Yes. `cms_pattern_live_pin_reason` returns the first of root inactive (:26), nested missing or inactive (:30-37), type containment at every edge (:41-72), digest or hash (:74-79). Root: setup ok 112. Nested: premises ok 116 (child active) and ok 117 (same owner, so the owner-scoped join finds it). Digest/hash: the raw-copy control (`A238-rawcopy-control`, ok 156/167) passes through the same copy path with the type set unchanged, and the digest branch comes after the type branch. Only the type set differs (premises ok 114, 115). |
| (c) production object restored byte for byte | Not applicable: no production object is substituted. |
| (d) the asserted behaviour is the clause's | Yes: the provider's exact outcome, reason and single-offender count (`failed`, `nested_pattern_not_active`, 1) in both phases for the direct edge and the second-level edge (BE03c 1585, DEC-199). By mutation reasoning over the CTE: reversing the containment direction passes {t1,t2} over {t1} and fails the direct row; testing only the root's direct children fails the recursive row only; removing the block fails both. |

Per citation: outcome rows (ok 178, 189, 200, 211) KEEP; guardrail controls (ok 134, 145, 156, 167) KEEP as **seam guardrails** (not proof; pinning them stops a later edit from removing an
isolation control, the refute3 5.1 precedent); frozen-status rows (ok 175, 186, 197, 208) DROP, adjacent (the helper line of a different function; no other AC-238 citation uses it).
Add as guardrails (missedTests): premises ok 114-117 and the two `a238_adopt` setup lines ok 112/113. Identity: all 12 proposed descriptions exist exactly once in the TAP (215 ok, 0 not ok,
215 distinct descriptions); they are computed and correctly cited under the entrypoint `.sql` (DEC-226 rule 5). Gap, not a DROP: the "same-owner" half of BE03c 1585's
"same-owner/all-parent-compatible-types" rule is not exercised (a foreign-owner pin is simply not joined and surfaces through the missing-nested branch with the same reason); the clause text is AC-211's
"listing every compatibleTypeIds member", the type half, which is proved.

### 4.2 DEC-226 (a fed token counts only if the database raises exactly that token on that operation) - AC-126, AC-128

Checked in `20261014030200_cms_create_taxonomy_version.sql` and its callees:

| Token fed | Raised by the database for CMS-03C-16 at | pgTAP producer evidence (exact message) |
|---|---|---|
| `NOT_FOUND` | :81 (concealment, create path); :180 (a successor of an absent or foreign lineage) | `taxonomy_definition/050-authority.sqlinc:13,16,26`, `040-validation.sqlinc:121` |
| `CONFLICT` | :177 (create over an existing key), :181 (stale parent), :184 (version ceiling), :203 (unique violation); the public wrapper :25 (deadlock or lock timeout) | `030-create.sqlinc:65`, `040-validation.sqlinc:118`, `060-review-successor.sqlinc:93,133` |
| `IDEMPOTENCY_MISMATCH` | :98 `cms_reserve` -> `identity_idempotency_reserve` (`20260901030000:376-378`); `cms_reserve` is still the `20260930150000:67-101` definition (later files redefine only `cms_reserve_conflict`); nothing in the body or the wrapper rewrites it | `030-create.sqlinc:59,62`, `060-review-successor.sqlinc:136` |

All three satisfy rule 4. The harness is the production route and RPC adapter over a stubbed transport that relays `HTTP 400 { code: 'P0001', message: <token> }`, which is how PostgREST relays a raise
(`taxonomyRpcFailure`, `taxonomy-definition-response.ts:104-170`). The lane's SQL line list is correct. The producer evidence exists in the suite; of it only the AC-126 c2 rows and some c6 "preserves every full snapshot
row" lines are cited, so five exact-message cases are recommended next to AC-128 c1/c2 (missedTests).

### 4.3 AC-169 BOUNDARY - accepted

Root's condition was "unless you find a real server/queue/job caller". Search over `apps/` and `packages/` (non-test): **no queue or job caller** of `cmsTemplateLatestRead` (the governed-recheck and event-consumer
code contains no template read). **Two server-side callers**, both one-shot: the SSR page `templates/[templateKey].astro:41` and the same-origin forwarder `pages/api/v1/cms/templates/[templateKey].ts:9`, through
`readCmsTemplateDetail` (one `binding.fetch`, no loop, a throw becomes `localError 503`). Neither retries, so the clause ("at most three") is met vacuously and there is no schedule to assert; a 15 s first delay cannot run inside
the 15,000 ms request deadline (BE03c 170). The missing spec the lane names is real. Alternative reading for root/owner, not applied: because the clause is a cap, "exactly one attempt" tests on the two callers would be true, but they prove no
schedule and DEC-211 recorded "no code change" for the server half.

### 4.4 Readings

- **AC-001** (root's, proven by web6 row 5, not here): the BOUNDARY facts hold - BE03c 320-326 digest tuple has no accessibility member, `cms_define_template` never mentions it, the only template accessibility text is 1828-1830.
- **AC-211** (root's ruling honoured): facts verified - closed provider reasons (BE03c 1585), frozen stored versions (`20261014020200:54-55`), the three placement-side re-proofs verbatim in `065-defensive.sqlinc:34-70`.
- **AC-272 "URL"** (for root): the lane reads "URL" as the browser URL. CMS-03C-08's 201 sets `Location: /api/v1/cms/governed-reviews/{reviewId}/assignments/{assignmentId}` (`governed-review-command-routes.ts:283`) and the Worker sweep checks outbound URLs and the ETag, not response headers.
  If "URL" includes the API `Location`, that header is a product defect, not a test gap. FE03 895 does not say; record the reading.
- **AC-042 "scoped draft before commit"**: read as FE03 927 (retain the draft, inline confirmation, beforeunload only while dirty, clear only after success or explicit discard), as AC-045 c12 and AC-048 c12 already are. The 15 `cmsTemplateDraftDirty` tests are kept as coverage of
  the predicate that arms the guard (`use-cms-template-draft-fields.ts:42`, `CmsTemplateEditDesigner.tsx:85-91`; the seven-member `fields` object is type-enforced); the component rows drive only key, audience and one content-type, so they are the only evidence for slot,
  binding, locale and extraRegions edits. They are the one place I would accept root trimming to the AC-045/048 shape (3-4 citations).

## 5. Per-criterion notes (full reasons are in the JSON)

- **AC-039** (27 KEEP). Rows are real route tests with the production guards. Verified with `node`: `Headers` keeps U+0001, U+007F and U+00E9 intact, and `requestWith`/`withKey` delete the header for `null` (so "missing" really sends none). Gaps: edges 7/8 and DEL/non-ASCII are route-tested on -08 and -16 only (the rest rest on the shared `IdempotencyKeySchema`); space (0x20) acceptance and the DB's own `cms_reserve` re-check (`20260930150000:82`) are unasserted.
- **AC-095** (5 KEEP, 1 DROP). The production guard is `templateReadMediaError` (415 with `allowedMediaTypes: []`) and `templateReadHeadersError` (content-length other than 0, transfer-encoding, a present body, Idempotency-Key, If-Match: 400), shared with CMS-03C-10 through `registerRead`. A GET `Request` cannot carry a body, so "a body" is proven through three header proxies, as the sibling does; the `request.body !== null` branch is unreachable from the harness.
- **AC-126 / AC-128** (2 + 5 KEEP). See 4.2.
- **AC-134** (4 KEEP). Rows 0-1: the second `rateLimit` call is the party bucket; both ceilings are echoed from the Worker's own `input.limit`. Row 2: a provider 500 is `503 DEPENDENCY_UNAVAILABLE` with one transport call. Row 3: fake timers pin the 8,000 ms ceiling to +-10 ms.
- **AC-042** (27 KEEP, 1 DROP). The jsdom tests observe the real `useCmsEditorialLeaveGuard` through a dispatched `beforeunload` and captured clicks; both extremes (always armed, never armed) fail row 0; the reset leg (`Start another draft`) fails if the fields survive the reset. DROP: `CMS_TEMPLATE_NO_AUTOSAVE` literal. jsdom level (PAT-031 caveat), same standard as AC-045/048.
- **AC-164** (9 KEEP, 6 FIX, 1 DROP). FE03 1129-1131: "It" is the context read. Rows 0-7 and 15 prove it does not extend the session resource (six strict members in OpenAPI and Zod, registry routes with no capability, the context a separate two-member resource, a widened reader not served). Rows 8-13 (the context schema refuses authority members) prove the next clause; re-file under c5.
- **AC-272** (7 KEEP, 1 DROP). The Worker sweeps run the production governed routes with the real logger sink (`lines.length > 0` asserted) and prove that the sentinel travelled where that matters (`travelled`). The refusal sweep over-claims its title ("every refusal"): CMS-03C-10 only, provider-driven only, three iterations identical. Residuals in finding 9.
- **AC-010 / AC-016.** Setup is a verbatim analogue of the existing latency apispecs (`createLatencyStack`, `prepareLatencyWorld`, `defineActivePattern`, the governed chain), the AC-016 request body is the one the latency taxonomy spec posts 120 times, and every DB expectation of AC-016 was checked against `cms_term_resource`, `cms_act_taxonomy_term` and the pgTAP oracle `030-create.sqlinc` with no mismatch. Weak spot in both: `stack.rpcs()` is not cleared before the asserted request.
- **AC-271** (no citations). Honest PARTIAL. `CmsTemplateDesigner.pending.test.tsx` (uncited, correctly) proves the CMS-03C-01 loading state on both designers.

Identity (static): no `skip`/`todo`/`only` in any cited file; the new files' SHA-256 equal the lane report; titles built with `it.each` (`%s`, `%i`, `$name`) are unique within their files; rows named with `$name` appear in the proposals in vitest's quoted and 40-character-truncated form (`'CMS-03C-07 refusal carrying a canonic...'`), which root must match against the JSON; the AC-238 file is a top-level `.sql` entrypoint and its computed descriptions are owned by it. I could not check vitest `fullName`s for the new files (no run JSON exists for them).

## 6. Guard simulation

With the repository's own `evaluateLedger` (`ledger-guard-lib.mjs`) over the real current ledger, the real tracker and synthetic passing receipts for every cited identity (the sole purpose is the structural rules: tiling, status and limitation, duplicates in a clause, sole-proof limit):

| Ledger | Problems | verified / partial / unverified |
|---|---|---|
| current | 0 | 229 / 64 / 3 |
| every KEEP and FIX applied (AC-164 re-filed under c5), REQUIRED and recommended `missedTests` added, statuses and limitations per the JSON, AC-272 **split** | **0** | **237 / 56 / 3** |
| the same with AC-272 **as proposed** (c0 cited, partial + limitation) | 1: `P2-S12-AC-272: partial entry: every clause is cited, so the entry is verified, not partial` | 237 / 56 / 3 |

No sole-proof exposure was added (no new test is the only citation of a clause for more than three criteria).

## 7. What root must do (apply by clause text, not by position)

1. Apply the 96 KEEPs and the six AC-164 FIX rows (under **c5**, not c4); do not apply the 8 DROPs.
2. **AC-010**: change `conflictState: null` to `'none'` at `pattern-placement.apispec.ts:117`; cite both rows only with a passed receipt from the PostgREST run after `pnpm db:reset`. **AC-016**: the same receipt condition.
3. **AC-039 c2**: add the 34 `missedTests`. **AC-134 c5**: add the three selector 502 tests. **AC-128**: add the five recommended pgTAP producer cases (c1, c2).
4. **AC-272**: do not apply c0 whole with `partial`. Either (a) wait for web6 row 4 to be KEPT, cite all eight under c0 and mark verified with an empty limitation; or (b) use the three-part split in the JSON, cite `splitParts` 0 and 2, hold the Worker diff row (part 1), `partial`, limitation as given.
5. **AC-238**: add the six guardrails of `missedTests`; status verified, limitation empty. **AC-211**: optionally cite the two A238 publish rows under c3.
6. **Limitations to rewrite**: AC-169 (corrected text), AC-271 (shortened), AC-042 (drop the c12 paragraph, keep c1 and c5), AC-164 (drop the c4 paragraph, keep c3 and c6).
7. Decisions for root: accept the AC-238 technique (my ruling: accept); record the AC-272 "URL" reading (browser URL vs `Location`); AC-169 BOUNDARY stands.

## 8. Files

| File | SHA-256 |
|---|---|
| `docs/handoffs/2026-10-22-claude-s12/recite4/refutation.json` | `08a2be151f152a750a714e899f6d377832f8c06709e93dda691a1001b2746c92` (15 entries, 111 citations: 96 KEEP, 8 DROP, 7 FIX; 34 + 3 + 5 + 6 + 2 `missedTests`) |
| `docs/handoffs/2026-10-22-claude-s12/review-refute4-report.md` | a file cannot name its own hash: it is in the final message |
