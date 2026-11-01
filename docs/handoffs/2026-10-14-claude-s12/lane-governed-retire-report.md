# Lane governed-retire report (claude_s12_governed_retire_sql)

Staged-runner lane `governed-retire`, Sonnet 5.5. Worktree `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`, branch
`claude/phase2-slice12`, HEAD `b16edb54a7a1b698ed8ca15b6085046d4270626e`. Timestamp range 20261014160000-169999 (used 160000, 160100, 160200).

## Status

**GREEN (fix pass appended below: retire now advances the review version by one; the figures in this first-pass section are superseded where they conflict).** CMS-03C-09 `retire` is built per DEC-190, test-first. Final-bytes run: governed activation 123/123, retire-pattern 68/68, governed schedule
and pattern-definition (regression, both drive the patched producer) all pass: 590/590 in one run. A mutant run (11 mutants over two runs) kills every
mutant; an idempotency witness (the three patches applied twice) passes 191/191. Worker: focused 31 files 913/913, tsc 0, eslint and prettier clean; one
Worker mutant killed. Full `apps/worker` 628 files 10,878/10,878. No applied migration, shared helper, other lane's file, trigger, clock or grant was touched.

## Scope (brief `briefs/governed-retire.md`, DEC-190)

`retire` requires the resolved subject `active` (else 409 `subject_not_retirable`); keeps authentication, unconditional binding-bound recent MFA before any
reservation, disclosure-safe review resolution, the subject-kind owner capability proved under the existing lock order (BE03c 1336-1357), review
`version` If-Match/`expectedVersion`, idempotency and transactional audit; needs NO fresh approval and NO dependency/policy/provider/preflight validity;
commits `retired`, lifecycle +1, `retired_at`, audit and exactly one subject-kind event (template/pattern/taxonomy types, BE03c 1546-1554); definition version and
pins unchanged; lineage advisory lock last, like activate.

## Design decisions (implementation tier, mine; root may override)

1. Three forward migrations (WIP, anchored patches, precedent `20261014150000`): (a) `160000` request structure step accepts `retire` and an optional `reason`
   (1..256 code points, NFC, `cms_editorial_reason_valid`; anything else `VALIDATION_FAILED ["/reason"]`; `reason` on activate/schedule and `activateAt` on retire stay
   `INVALID_REQUEST`); (b) `160100` new private helpers `cms_governed_retire_subject` and `cms_governed_apply_retirement`; (c) `160200` the retire branch of
   `cms_activate_governed_subject`, four one-line-or-block anchors, each exactly-once and independently skippable, every non-body `pg_proc` attribute compared before/after.
2. Retire branch placement: after the review CAS the review state is NOT required to be `approved` (B1); the subject must be `active` else `subject_not_retirable` (B2);
   the verdict function is not called, so a stale dependency, an unbuilt provider or an unavailable workflow policy cannot stop or invalidate anything (B3); after the
   lineage advisory lock the retirement is applied and the 200 stored (B4). The graph locks (positions 3-4) and the review row lock (position 5) are still taken, locks only;
   no lineage active-row lock is taken (BE03c 1348 lists it for `activate` only).
3. The review `version` does NOT advance on retire (BE03c 215 lists a decision, an invalidation and an activation only; fix4 already removed the Worker's +1 binding).
   The review row is byte-identical afterwards (asserted). The 200 `reviewVersion` is the unchanged version.
4. `activatedAt` in the retire resource is the subject's ORIGINAL `activated_at` (the contract allows it for `retire`; the Worker fixture already carried it).
5. Defence in depth: the subject state is checked three times (branch B2, `cms_governed_apply_retirement`, and `where state = 'active'` in `cms_governed_retire_subject`).
   Mutant M10 shows this is load-bearing: with all three removed the database lifecycle guard did NOT stop an `approved -> retired` update (retire of an approved subject returned ok).
6. Worker (retire mapping only): `validGovernedActivation` now binds a retirement on the unchanged review version (`reviewVersion === expectedVersion`), the one binding the ratified
   decision permits; fix4 had left it unbound while the policy was open. This is a tightening of a previously reviewed Worker rule: see Test corrections 3 and Requests to root 2.

## Files

### Migrations (WIP, promote with the lane, in order)
| path | lines | SHA-256 |
|---|--:|---|
| `supabase/migrations-wip/governed-retire/20261014160000_cms_governed_retire_request.sql` | 90 | `9ac684112161ab6c2ade99d26798ca9ef2c302d04a025d9f96f0ed03c12b0084` |
| `supabase/migrations-wip/governed-retire/20261014160100_cms_governed_retire_apply.sql` | 138 | `1ff0c14b489fab50c455cc9aab4f4f8599ca0ed7e033b61649e5ea27b179a943` |
| `supabase/migrations-wip/governed-retire/20261014160200_cms_governed_retire_branch.sql` | 103 | `0c0c0edbd73bcc7822648249836a26ab5f4acc9a2f78eebe2959d068ed4b0728` |

### pgTAP
| path | lines | SHA-256 |
|---|--:|---|
| `supabase/tests/phase_02_slice_12_governed_activation.sql` (plan 92 -> 123, includes 095) | 43 | `326804cb24c1aa13aa1d2a66effa942c8d0e0b08e4391357dcad9ad3f88a16df` |
| `supabase/tests/phase_02_slice_12_governed_activation/020-gates.sqlinc` (held-retire replaced, boundary cases added) | 140 | `bd665561c15e9931747590e8ffb4fd6b79c910b70ebe05ee1e8398d0bc701365` |
| `supabase/tests/phase_02_slice_12_governed_activation/030-activate.sqlinc` (held-retire replaced) | 77 | `86f9178e88c477f09ea36a4e4bd7da06739c9f3189310241452be3713133e03d` |
| `supabase/tests/phase_02_slice_12_governed_activation/070-privileges.sqlinc` (two EVIDENCE rows) | 44 | `71fe023cda34681a578f677cc2b07589983ed589f4908b9d281bceed0d72ef0d` |
| `supabase/tests/phase_02_slice_12_governed_activation/095-retire.sqlinc` (new, 31 assertions) | 246 | `17178817da8c4b71cc49f061048f19678c8327dcb92fcf5b9e4d7387ac5b23d7` |
| `supabase/tests/phase_02_slice_12_governed_activation/README.md` | 25 | `529f1fb756916e48f28e825a4c39fc4bedb29ab3a127cf43f00367b7971c9779` |
| `supabase/tests/phase_02_slice_12_governed_retire_pattern.sql` (new, no_plan; 68 assertions) | 24 | `8be6aa264dee2314571ea5a0c3d83c07340401c824ae6b22a990813c01becbcc` |
| `supabase/tests/phase_02_slice_12_governed_retire_pattern/010-retire.sqlinc` (new) | 60 | `88b6de61737a17529e88b8aaf751bc1fb12db60bbffa7e9d93ec6f3f12df25bd` |
| `supabase/tests/phase_02_slice_12_governed_retire_pattern/README.md` (new) | 7 | `05e2e6d7b705478616358509c2fd71b84593ce18af889c9407a317ae3b98bcb5` |

### Worker (`apps/worker/src/cms-composition/`, retire mapping only)
| path | lines | SHA-256 |
|---|--:|---|
| `governed-review-validate.ts` | 157 | `c20a596d8426aa311c87f80ecce5e231352f50251fe35592aee48e48bf45b4fd` |
| `governed-activation-routes.ts` (comment only) | 109 | `8d4ee510ed566dd59397424019cce10082da6be82903d24e505ae7105cf58b56` |
| `governed-activation.test-support.ts` (`retiredResource` default review version 3) | 196 | `822dacec412d6c1db52249f83070289883da2a8da76d4469924bc1956f39bf80` |
| `governed-activation.test.ts` (retire describe rewritten, 10 tests) | 321 | `75b5cb53a3ed8142ea9098fdcbd8de8e06fd303c55724f7d47a3b87260965494` |

All files under the 300-line limit. No new SQL directory exceeds the README rule (the new test directory has two files and a README anyway).

## Runs (all through `lane-db-alt-staged.sh`; TAPs in `.lane-logs/`)

| # | stamp | targets (plan) | result | notes | TAP sha256 |
|---|---|---|---|---|---|
| RED-1 | 023717-3793235 | activation 119 (wip=0) | 23 not ok of 119 | Genuine missing feature: every retire call answers `VALIDATION_FAILED ["/action"]` at the structure step. Not harness. | `7425bf127bbe2b78df2340fa0f50bff4853ab044143ce5173645156e90441233` |
| GREEN-1 | 023845-3802336 | activation 119 (wip=3) | 117/119 | 107-108 failed: TEST defect (my fixture invalidated the review of an ACTIVE subject; the review guard and the `activated_at -> approved` check make that unreachable). Fixed in the test; no product change. | `98ee481f59b6814690aa3bcd75ce8d6014a750cfd88e2c4cc8a5e6469d887a45` |
| GREEN-2 | 024129-3816945 | activation 120, retire-pattern (wip=3) | 187/188 | pattern suite 68/68; 107 failed: test defect (called the verdict, which judges the stale dependency first). | `f461b65f90ae1b8e280f36d7e5ff0fd801cab02f4ba4f2cd7d076cbbac58e3be` |
| GREEN-3 | 024315-3826802 | same | 187/188 | 107 failed: test defect (direct call to `cms_governed_review_qualifying_decisions` from the test session returns nothing outside an RPC context). | `afe59bf64ac7f104c0d074726b1aa05b4b76f55fbc8b1cc16d02ebc274da9727` |
| DIAG | 024422, 024538 | activation 120 | 119/120 | two diagnostic runs (diag lines only) to find the cause of GREEN-3; removed afterwards. Cause above. | `4e071f51...`, `9523c9e0...` |
| GREEN-4 | 024659-3849314 | activation 122, retire-pattern | 190/190 | scenario redesigned: two real protected reviews (gq1 activated, gq2 not), then the specialist approver's grant is revoked; activation of gq2 commits the invalidation, retirement of gq1 succeeds | `e6321208e019bca0c0e8ec27605069a67b70382866a05f40054b02c50dcd27e7` |
| **FINAL** | 024832-3860296 | activation 123, retire-pattern (68), governed_schedule, pattern_definition (wip=3) | **590/590 PASS** | final bytes of every file above (one audit-row assertion added after GREEN-4) | `af172aa478f2d855472fc7abc67821f443c28a0a4b58cca4c42854fcacd72490` |
| MUT-A | 025433-3891189 | activation 123, retire-pattern | 30 not ok, all mutants killed | scratch lane `governed-retire-mut` (removed afterwards; real lane untouched) | `a715be310e07a7b3ba1094a52f1ecc6ee6dda5d2b22f75ec77040328a82c8163` |
| MUT-B | 025758-3910466 | activation 123 | 17 not ok, both mutants killed | scratch lane `governed-retire-mut2` (removed) | `6e18c67ca6be105e6b5325e4ef8558800de99351385d6f9302f46e5c1be170aa` |
| IDEM | 025930-3920486 | activation 123, retire-pattern; wip=6 (the three migrations applied a SECOND time under later timestamps) | 191/191 PASS | idempotency witness: every anchor skip path and the helper re-create are exercised on the already-patched database; scratch lane `governed-retire-idem` (removed) | `53f3b25a328ba921aadc70f453f5e435dc1c64f2cfca47bfe8d5ffbca109899c` |

Failure classification: RED-1 genuine missing feature; GREEN-1..3 test defects of mine (classified above); no harness abort and no product defect in the retire code.

Mutants (applied to copies only): M1 verdict consulted for retire (95-97, 111, 116 ...), M2 response review version +1 (97, pattern 63), M4 event aggregate version -1 (99, 118, pattern 66),
M5 retirement applied before the advisory lock (102), M6 `/reason` validation removed (20, 91), M7 template event type for every kind (117, 118, pattern 63/66), M8 `reason` accepted on activate (18),
M10 retire of any state: branch, apply and helper state checks removed (19, 93, 94, pattern 68), M3 no event/audit (99-101), M12 retire skips the step-up (20, 91, 92). Several failures are cascades of one mutant; each has at least one
assertion written to catch it. M1/B1 (review must be approved) has no mutant: a review whose subject is active is always `approved` (guard + check), so the B1 relaxation is unobservable by construction.

Contract conformance (offline throwaway `node --experimental-strip-types` script over the `EVIDENCE rt1` and `EVIDENCE rt-tx` rows of the FINAL TAP): both bodies parse against the frozen `GovernedActivationResourceSchema` (2/2).

Worker (pinned PATH, `flock -s /tmp/wejammin-quiet.lock`, vitest 4.1.11):
- focused `apps/worker/src/cms-composition/governed- apps/worker/src/cms-governed-activation`: 31 files, 913/913.
- `apps/worker` `tsc --noEmit`: exit 0. eslint and prettier --check on the four touched files: clean.
- Worker mutant W1 (retire accepted with any review version, in `governed-review-validate.ts`): 3 failed in `governed-activation.test.ts` (versions 4, 5, 9); file restored, SHA verified unchanged.
- full `apps/worker`: 628 files, 10,878/10,878 (435 s).

TDD note (honest): the SQL side is strictly RED-first (RED-1). The Worker tests and the Worker binding were changed together and I did not capture a RED vitest run before the code change; RED for the Worker
is proven afterwards by W1 (the new binding is load-bearing) and by the 31-file focused run staying green with the rewritten retire tests.

## Test corrections (existing oracles that contradict DEC-190; independent review please)

1. `supabase/tests/phase_02_slice_12_governed_activation/020-gates.sqlinc`: the assertion "retire is HELD: refused `VALIDATION_FAILED ["/action"]`" (labels `retire-held`, `retire-held-reason`)
   -> the same two calls on the still-approved `gg1` plus an in-review `gopen` now expect `P0001:subject_not_retirable` (a structurally valid retire reaches the state check). Plan unchanged by the swap; one boundary assertion added
   (reason of 1 and 256 code points incl. 256 two-byte characters passes, 257 is `/reason`, activateAt is INVALID_REQUEST, step-up first).
2. `supabase/tests/phase_02_slice_12_governed_activation/030-activate.sqlinc`: `a1-retire` asserted HELD (`VALIDATION_FAILED ["/action"]`, no state change, no reservation) on the ACTIVE `ga1`; ga1 is now the subject of the
   real retirement in 095, so the line becomes the stale-version retire: `VERSION_MISMATCH {expectedVersion 2, currentVersion 3}`, nothing changed, nothing reserved (the review CAS precedes the state check). The final count assertion's text is reworded only.
3. `apps/worker/src/cms-composition/governed-activation.test.ts` + `governed-activation.test-support.ts`: the "retire is forwarded unchanged (owner decision open)" describe is rewritten. Removed: the test that expected the
   SQL's `VALIDATION_FAILED ["/action"]` refusal for retire; the `it.each(['3','4','9'])` test that accepted any review version for a retirement (fix4, while the policy was open). Replaced by: 200 with ETag "3", reasonless forward,
   `subject_not_retirable` 409, `/reason` violation, stale-version 409, and `it.each(['4','5','9'])` that REFUSES an advanced review version (502). `retiredResource` default `reviewVersion` '4' -> '3' (a retirement does not advance it).
   Strictly stronger on the version; the three other fix4 retire tests (another review, not-a-retirement, step-up) are unchanged.
4. READMEs of the two suites, the activation entry file's header and `020-gates.sqlinc`'s header describe `retire` as implemented (was "HELD").

## Spec citations

BE03c = `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md`; DEC-190 = `.memory/wiki/decisions.md` (end).

| Behavior | Source |
|---|---|
| retire: active subject only, else 409 `subject_not_retirable`; optional reason 1-256 NFC | BE03c 392, 1326 (`retire`), DEC-190 |
| no review needed / removes exposure only; emits the subject-kind event; retired fails the 03b preflight and the 03a resolver as WITHDRAWN | BE03c 1326, 1492, 1552-1554; resolver `20261002132000` already answers WITHDRAWN for `retired` |
| unconditional step-up before any reservation, review `version` as If-Match, idempotency | BE03c 171, 216, 1326 steps 1-3 |
| lock order (authority rows, subject, graph, review, advisory lock last) | BE03c 1336-1357 (row CMS-03C-09) |
| review `version` not advanced by a retirement | BE03c 215 (decision, invalidation, activation only) |
| lifecycle +1 on retirement, `retired_at`, definition version unchanged; outbox identity = subject row at its lifecycle counter | BE03c 208, 1561 (DEC-188) |
| event types per subject kind | BE03c 1552-1554; contract `CMS_GOVERNED_ACTIVATION_EVENT_TYPES` |
| resource shape for `retire` (200, `subjectState` retired, event type set) | `governed-activation.ts` `GovernedActivationResourceSchema` |

## Open items / BOUNDARY

1. BOUNDARY (spec gap, not invented): the optional retire `reason` is validated and is part of the idempotency request hash, but BE03c names no column, audit member, event member or resource field that stores or returns it
   (`audit_events` carries only a coded `reason_code`; the review and subject tables have no reason column). It is therefore not persisted. Missing spec: where the retirement reason is recorded (e.g. a `retirement_reason` lifecycle column or an audit payload). No stub was written (the three-part test fails at question 2: it needs a schema/audit decision).
2. Race behavior is unproven (race modules forbidden): the lost-race path under the advisory lock cannot be exercised in one pgTAP session; the position is proven by a SOURCE ORACLE (095, labelled weaker than behavior) and mutant M5.
3. Downstream consumers of `retired` (the 03b publication preflight, the 03a resolver) are unchanged here; the resolver already maps `retired` to `WITHDRAWN` (existing code, existing S09 test forces the state); not re-tested end to end through this producer.
4. The retry-ladder suite (`phase_02_slice_12_governed_schedule_ladder`, ~460 s) was not rerun: the executor (CMS-03C-19) is unchanged; the schedule suite (56) that exercises execute and activation helpers passed in FINAL.
5. A retire request for a `scheduled` subject is refused (`subject_not_retirable`); cancelling a pending schedule is not a retirement and stays through review invalidation (BE03c 1328). A `blocked` subject is likewise not retirable.
6. Stored idempotency records and the Worker/Web layers beyond the retire mapping (the Web activation form of DEC-190 Downstream) are outside this lane.

## Requests to root

1. Promote `supabase/migrations-wip/governed-retire/20261014160000_cms_governed_retire_request.sql`, `...160100_cms_governed_retire_apply.sql`, `...160200_cms_governed_retire_branch.sql` in that order into `supabase/migrations/`
   (order matters: 160200 calls the 160100 helpers), then the canonical gates including a populated-DB `migration up` witness (IDEM already shows the double-apply is safe on a fresh stack).
2. Review Worker change 6 / Test correction 3: retirement answers are now bound on `reviewVersion === expectedVersion`. If you prefer fix4's unbound form, revert only the `&&` clause in `governed-review-validate.ts` and the `it.each(['4','5','9'])` test.
3. Decide the BOUNDARY above (where the retire reason is stored); until then it is validated and hashed only.
4. The Web activation form of DEC-190 Downstream (the "Entries bound to this version can no longer publish" retire radio) is not part of this lane.

## Fix pass

Root ruling (binding, brief `briefs/governed-retire-f1.md`): retire ADVANCES the review `version` by exactly one, like activation (CMS-03C-10's strong
ETag is `"{review.version}"`; BE03c 215 counts an activation as a version change). This section supersedes Design decision 3, Test correction 3's
"does not advance" wording, Worker change 6, and Request to root 2 of the first pass above. The retire-reason BOUNDARY stays as written.

### Checkpoint 1 (tests edited, RED not yet run)
- 095-retire.sqlinc and the pattern retire suite oracles rewritten to expect version + 1 (review row differs only in `version` and `updated_at`;
  `reviewVersion` = expected + 1; second retire with the pre-retire version is VERSION_MISMATCH current+1; replay of `rt1` pins explicit expectedVersion 3).
  Activation entry plan 123 -> 124 (one added assertion `rt1-stale`). Pattern suite is no_plan (one added assertion).
- Next: RED run, then SQL (160100 helper CAS update, 160200 response), then Worker (test first), then reruns.

### Runs (fix pass)
| # | stamp | targets | result | classification | TAP sha256 |
|---|---|---|---|---|---|
| FRED-1 | 031152-3983563 | activation (plan 124), retire-pattern; WIP unchanged (3 old migrations) | 9 not ok of 124 (97-98, 105, 108, 112-113, 117-119); pattern 5 not ok of 69 (63, 65, 67-69) | genuine missing feature: the old retire leaves the review version unchanged; every failure is a version assertion. No harness abort. | `f81ca8180e1fb260b286bdb4c3bc4491ca4674e503ee2af615868cc3e4f7bd84` |
| FRED-W | vitest | `governed-activation.test.ts` before the validator change | 3 failed of 27 (ETag "4" accepted as 502; two refusal cases) | genuine: validator still bound equality | n/a |
| FGREEN | 031318-3991836 | activation (124), retire-pattern (69), governed_schedule, pattern_definition (wip=3, fixed bytes) | **592/592 PASS** (4 files) | final bytes | `ece6500394da5112f30f72b7ed10bdc11d50524eb9dcec7b21e94c3ace9453f6` |
| FIDEM | 031912-4022903 | activation, retire-pattern; wip=6 (the three fixed migrations applied a SECOND time as 161000/161100/161200) | 193/193 PASS | idempotency witness; scratch lane `governed-retire-idem` (removed) | `81412018d53ab21927d2a4dafe9cf1f2476695a824ec88daf7be3ea228b2b5b4` |
| FMUT | 032004-4028047 | activation, retire-pattern; scratch lane `governed-retire-mut` (removed) | 7 not ok (97, 108, 112, 113, 117, 118; pattern 63): mutant killed | mutant: 160200 answers `reviewVersion` = the pre-retire `v_review.version` while the row advanced | `0011ec906eb2616aa3b56662577764b33fe577e232adc08f84c133ca33b37dc7` |

Worker (pinned PATH, `flock -s /tmp/wejammin-quiet.lock`): focused `governed-` + `cms-governed-activation` 31 files 913/913; `governed-activation.test.ts` 27/27;
`apps/worker` tsc --noEmit exit 0; eslint and prettier --check clean on the four touched files; full `apps/worker` **628 files, 10,878/10,878** (303 s).
TDD note: the Worker RED (3 of 27 failing before the validator change) was captured this time (FRED-W); the first pass's lack of a Worker RED is superseded.

### What changed (all unpromoted WIP and tests; no applied migration touched)
1. `20261014160100_cms_governed_retire_apply.sql` (150 lines): `cms_governed_apply_retirement` now advances the review `version` by exactly one under CAS
   (`update ... set version = version + 1, updated_at = p_at where id and version = v_review.version`, `VERSION_MISMATCH` if the CAS fails), mirroring
   `cms_governed_apply_activation`, after the subject move and before the event; `state`, `activated_at`, `decided_at` and every frozen review column stay (the
   review guard permits approved -> approved with version + 1 and unchanged activated_at). It returns `reviewVersion`; the helper still takes the lineage advisory
   lock only through its caller (last position). Its review grant becomes `select, update` (already held from `20261014070400`; idempotent).
2. `20261014160200_cms_governed_retire_branch.sql`: the retire branch answers `reviewVersion` = `v_applied->>'reviewVersion'` (expected + 1). Anchors unchanged.
3. Worker `governed-review-validate.ts`: a retire answer binds `subjectState retired` AND `reviewVersion === expectedVersion + 1` (same as activate); the ETag on the 200
   is already `resource.reviewVersion`, now the advanced version (`"4"` in the test). Comments in `governed-activation-routes.ts` updated.

### Test corrections (ruling-forced; for independent review)
1. `095-retire.sqlinc`: `s12gb_ret_effect` no longer asserts the review row byte-identical; it asserts `version = pre + 1`, `updated_at >= pre`, and the row equal to the
   pre-image in every other column. `reviewVersion` expectations 3 -> 4 (ga1, gl2, tx), 4 -> 5 (gp1); the taxonomy review row `version = 4` and still approved + activated.
   The replay of `rt1` and its different-reason mismatch call pass the pre-retire `expectedVersion '3'` explicitly (the helper otherwise reads the live, advanced version and the
   request hash would differ); one assertion added: a second retirement with the pre-retire version `3` is `VERSION_MISMATCH {expectedVersion 3, currentVersion 4}` and reserves nothing
   (the observable consequence of the bump). Plan 123 -> 124 in `phase_02_slice_12_governed_activation.sql`.
2. `phase_02_slice_12_governed_retire_pattern/010-retire.sqlinc`: `reviewVersion` expected pre + 1; review row differs only in `version`/`updated_at`; the store-diff oracle now
   lists `platform_private.cms_governed_reviews` among the written stores (review CAS); `retire-again` sends the advanced version (stays `subject_not_retirable`); one assertion
   added: a second retire with the pre-retire version is `VERSION_MISMATCH`.
3. `governed-activation.test.ts` / `-test-support.ts`: `retiredResource` default `reviewVersion` '3' -> '4'; ETag `"4"`; the refusal `it.each` is now `['3', '5', '9']`
   (equal-to-expected, and over-advanced, are 502 `DEPENDENCY_UNAVAILABLE`); describe title updated. README line 20 and comments updated.

### Spec citations (additions)
- Root ruling `briefs/governed-retire-f1.md`; BE03c 215 (an activation advances the review version); CMS-03C-10's strong ETag `"{review.version}"` (BE03c, per the ruling).
  The review guard (`20261013300600`, approved -> approved branch) accepts version + 1 with `activated_at` unchanged.

### Open items / BOUNDARY (unchanged)
Retire-reason storage BOUNDARY stands as written (validated and hashed, not stored; spec names no storage). Items 2-6 of the first pass stand. Race and populated-DB witnesses remain root's.

### Requests to root (fix pass)
1. Promote the three WIP migrations as in the first pass (hashes in the Files table are superseded): 160000 `9ac68411...0084` (unchanged), 160100 `b087900c94fbd8733c8defa864974fa8b332d3faaf88e9674e074a1e8102083a` (150 lines),
   160200 `e60d6dd5fe0dc1a4567b7bd8c083fcd2102703007dea6b4db90f8829b513718f` (103 lines).
2. Request 2 of the first pass (Worker equality binding) is withdrawn; the ruling's `expected + 1` binding is in.
3. Other readers of a retired review's `version` (the Web activation form of DEC-190) must treat `reviewVersion` of the 200 as the new ETag.

### Final file hashes (fix pass)
| path | lines | SHA-256 |
|---|--:|---|
| `supabase/migrations-wip/governed-retire/20261014160100_cms_governed_retire_apply.sql` | 150 | `b087900c94fbd8733c8defa864974fa8b332d3faaf88e9674e074a1e8102083a` |
| `supabase/migrations-wip/governed-retire/20261014160200_cms_governed_retire_branch.sql` | 103 | `e60d6dd5fe0dc1a4567b7bd8c083fcd2102703007dea6b4db90f8829b513718f` |
| `supabase/tests/phase_02_slice_12_governed_activation.sql` | 43 | `403d76d22d338d3902fa576a01ce619d07f5fc1d566219368ab5e3baa791e4a9` |
| `supabase/tests/phase_02_slice_12_governed_activation/095-retire.sqlinc` | 259 | `505fa559f28d4b6355db73a21b5f9a675e4dbcd44ae9d9799831b47ffa89ce35` |
| `supabase/tests/phase_02_slice_12_governed_activation/README.md` | 25 | `754580b98f27b9e668fefdfba2cecaa49b164f6278791b79f7f84200128e470a` |
| `supabase/tests/phase_02_slice_12_governed_retire_pattern/010-retire.sqlinc` | 72 | `63300c32f7af2ed782a075985db5a84bdb20efc235ec6546396cf7401ce94810` |
| `apps/worker/src/cms-composition/governed-review-validate.ts` | 158 | `e36b55b515741e5cd672aba97984f2aa43ecde86bf7a6f9a60582e80587b5ae3` |
| `apps/worker/src/cms-composition/governed-activation-routes.ts` | 110 | `03faa748dc1c46acd49c87fbaa83fb143921d4ade36996fd05eb6ea7ae77b939` |
| `apps/worker/src/cms-composition/governed-activation.test.ts` | 321 | `3a4ea08bbc25337d9a224d077beb143e217da4b30934f11554545a05b3533b2e` |
| `apps/worker/src/cms-composition/governed-activation.test-support.ts` | 196 | `ee36dbb18821329d18dcf0550c7329e04e4815afaa430081fe12673819559dea` |
