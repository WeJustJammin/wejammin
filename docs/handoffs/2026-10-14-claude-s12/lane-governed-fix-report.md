# Lane governed-fix - four defects in applied governed SQL (plus one found on the way)

- Date: 2026-10-14
- Lane: `claude_s12_governed_fix_sql` (staged-runner lane `governed-fix`), model Sonnet 5.5
- Worktree: `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`, branch `claude/phase2-slice12`, HEAD `b16edb54a7a1b698ed8ca15b6085046d4270626e`

## Status

GREEN for everything provable in a governed-fix-only staged run. Final run R6: governed-submit 74/74, governed-fix 18/18
(92 pass, 0 fail, no harness abort). Behavioral end-to-end proof of defects 2 and 3 needs pattern and taxonomy producers
that are not promoted: they are covered here by catalog-source oracles only (labelled), and the behavioral proof is a
combined staged run requested from root (see Requests 1).

All four brief defects fixed with RED-to-GREEN evidence; one fifth defect (digest tuple `lifecycle: null`) was exposed by
fixing the first and is fixed in the same migration.

## Scope

1. `cms_governed_current_digest` pattern branch 42P10: fixed (anchor 1 of `040000`).
2. Submit raised `pattern_version_not_active`: now `subject_not_submittable` (anchor 1 of `040100`).
3. `canonical_source_unavailable` without DETAIL: now `{"domain": <first declared unbuilt domain>}` (anchor 2 of `040100`,
   030500's reviewed replacement text, folded).
4. Stored-hash mismatch: now `VALIDATION_FAILED` + DETAIL `["/subjectHash"]` (anchor 3 of `040100`); state/live-review stay 409.
5. (found) pattern-branch tuple hashed `"lifecycle": null` for a registered block with no lifecycle event; now `supported`
   (anchor 2 of `040000`). Without it the first run after fix 1 gave wrong digests (R4: #10, #12 fail; R5: pass).

Decision (my call, implementation tier): both migrations are anchored patches, not full-body redefinitions. Each anchor is
asserted to occur exactly once in the live `prosrc`; owner, ACL, config, volatility and OID are compared before/after
(`to_jsonb(pg_proc) - 'prosrc'`). Smallest possible byte change, so every untouched statement of the applied
`300400`/`300820` bodies is provably identical. 030500 is **deleted from my directory and folded** into `040100`
(patch 2). Composition if root promotes 030500 first was proven in R7 (below): patch 2 is skipped via the
`jsonb_build_object('domain'` marker.

Ordering decision (not pinned by a test, spec order 389 states hash then state): the hash is compared before the state, so a
stale hash on a non-draft subject is 422, a correct hash on a non-draft subject is 409.

## Files

| Path | Lines | SHA-256 |
| --- | --- | --- |
| supabase/migrations-wip/governed-fix/20261014040000_cms_governed_digest_pattern_order.sql | 81 | ff72249db553564072714527b13348e08842c49a97a49073b4691d883d6aa9b3 |
| supabase/migrations-wip/governed-fix/20261014040100_cms_submit_governed_review_refusals.sql | 90 | 0e25c13b34da889c746169421a010fc1f97255576b93eee88f7597215f3ff940 |
| supabase/tests/phase_02_slice_12_governed_submit.sql (plan 60 to 74, one `\ir`) | 295 | 4ad2b755e9116451d8ed724fbee464e1b050204a6166b2717225b3daf044e192 |
| supabase/tests/phase_02_slice_12_governed_submit/030-hash-refusal.sqlinc (new, 14 assertions) | 73 | c0331c131e094036190af5d8cac7432605b037aea69160519ba5ce319ac5e3f1 |
| supabase/tests/phase_02_slice_12_governed_submit/README.md (appended section) | 71 | b19623b0ae9a541e6d1f9a9b5eaa16902277b99482f5b746eec64b0bd24a18d6 |
| supabase/tests/phase_02_slice_12_governed_fix.sql (new) | 26 | fa39e987809141e409fc0a65d2cfeae96875037b3cb4bb3f890bf727461b4082 |
| supabase/tests/phase_02_slice_12_governed_fix/000-blocks.sqlinc | 26 | 4f85cbcbe3cd2cfde63788e5d94555f3ed866485324403793701b53611e46e48 |
| supabase/tests/phase_02_slice_12_governed_fix/005-submit-source.sqlinc | 28 | 3ec4d35e69a26d120e9d76fbe9960dbfe3974d2ac8dee294e6a1de466e8e84ee |
| supabase/tests/phase_02_slice_12_governed_fix/010-digest.sqlinc | 94 | 33ff685ecdf98cc7d8590c60bb17c05bd90efa4e0209e7ab495aede79bde2483 |
| supabase/tests/phase_02_slice_12_governed_fix/README.md | 19 | 81220064412d111eac1635faef31d918a027d4b40788129e9c762236147a7f0b |

Deleted: `supabase/migrations-wip/governed-fix/20261014030500_cms_submit_canonical_source_detail.sql` (root-moved; SHA-256
`f41cf1c72d0587c95601c15c97cbb91cb688fbb351dff0f3a0078c885e22c600`, copy kept in the lane scratchpad; folded, see Scope).

Governed-submit suite integrity: the suite is untracked, so there is no git baseline. The pre-change file reconstructs by
reversing exactly two edits (`plan(74)` to `plan(60)`, delete the one `030-hash-refusal` `\ir` line); that file's SHA-256 is
`318717a7f17bc2170f6d68994466ded43ef401b5db5ddb6e023d0436117c8253`, 295 lines. Every one of the original 60 assertions is
byte-identical and passes (TAP 1-60 in every run). The new include sits after the role control because that control counts
exactly nine receipts.

## Runs (staged runner, lane `governed-fix`, 2026-10-14 local)

| # | Time | WIP | Files / plan | Pass/Fail | First failure and class | TAP | SHA-256 |
| - | ---- | --- | ------------ | --------- | ----------------------- | --- | ------- |
| R1 | 06:35:58 | none (030500 withheld to expose live state) | submit 74, fix suite 3 before abort | submit 71/3; fix 2/1 + abort | submit #63 `VALIDATION_FAILED` vs `subject_not_submittable`, #64 DETAIL null, #68 cross-subject hash: GENUINE missing feature (defect 4). Fix #3 + `ERROR 42P10`: GENUINE defect 1. | alt-staged-governed-fix-063558-3105126.tap | c86c1ab0c406449beac0ff5eab4d11758e27bd0927ee673cd5d05ff2dc2ab305 |
| R2 | 06:37:10 | none | fix suite, hardened (raises caught, source oracles first) | 6 pass / 10 fail + abort | #4-#8 source oracles fail (defects 2, 3, 4: GENUINE); #9, #10, #12, #13, #14 digest 42P10 (GENUINE defect 1); abort at #17 `text \|\| "char"` is HARNESS (my test, fixed) | alt-staged-governed-fix-063710-3112204.tap | c557db7f867b8b3bf72fbf9b7be9838babf3a15aa5c6f2de0b4e24da132f90a7 |
| R3 | 06:37:50 | 040000 (first cut), 040100 | submit 74 + fix 18 | submit 74/74; fix 14/4 | #9, #10, #12: `RAISED P0001 VALIDATION_FAILED` and #17: HARNESS (digest called without `app.cms_rpc`, the registry is forced-RLS; `proconfig` text form) | alt-staged-governed-fix-063750-3117212.tap | e4d9d268bd8efd6e8d13bd3419129c50c71d87319a911be687b5f3850c82ab15 |
| R4 | 06:38:40 | same | fix 18 | 16/2 | #10, #12 wrong hash: GENUINE defect 5 (tuple `lifecycle` NULL; the digest no longer raises, 42P10 gone) | alt-staged-governed-fix-063840-3122725.tap | 9b38d5edd50e3a6411f48ec8112f9b596b6fa1e30b94379bf4aeb81e09616fec |
| R5 | 06:40:07 | 040000 (with lifecycle anchor), 040100 (earlier cut) | submit 74 + fix 18 | 92/0 | none | alt-staged-governed-fix-064007-3132028.tap | d800dce2fd44196ed50379bb07a4758f73bbb5055948c5f439ea682eb28dfddf |
| R6 | 06:41:41 | final 040000 + final 040100 | submit 74 + fix 18 | **92/0** | none (final bytes) | alt-staged-governed-fix-064141-3141995.tap | 536e47c063f2e095ad504d3d3a3fc158ec40e162c44eed8fffd9ba710bbcb676 |
| R7 | 06:42:24 | 030500 + final 040000 + final 040100 (composition probe; 030500 removed again afterwards) | submit 74 + fix 18 | 92/0 | none: patch 2 skipped, 030500's DETAIL kept | alt-staged-governed-fix-064224-3147327.tap | f1182b9366ac35d0634163d99ddeb64e7a35cef94d1b967461f7e271a4535014 |

R5 differed from R6 only by the `applied_markers` composition guard added to `040100` (R5 used the `6910402e…` cut).

## What the new assertions prove

Governed-submit `030-hash-refusal` (14): two real draft templates with distinct stored hashes; wrong hash (and another
subject's valid hash) raise `P0001` `VALIDATION_FAILED` with DETAIL exactly `["/subjectHash"]`, no body, scoped stores
byte-identical (subject incl. `lifecycle_version`, review, dependency, idempotency rows; audit/outbox by count), zero live
reviews; positive control: the correct hash submits the same draft and exactly one live review exists; a non-draft subject with
the correct hash and a fresh key stays `subject_not_submittable`; the four added calls run as `service_role`.

Governed-fix (18): `cms_governed_current_digest('pattern_version', ...)` evaluates over four real signed blocks; folds each
reachable block once, ordered by key in byte order (`fix-c` < `fix.b` < `fixa`) then version, as the JCS SHA-256 of independently
built tuples; node-order independent; grandfathered `{"nodes": [...]}` shape; empty tree equals the JCS hash of `[]`; an
unregistered reachable block still raises `P0001 VALIDATION_FAILED`; template branch equals `cms_template_block_digest`
(digests for the existing subject kinds unchanged); taxonomy NULL; function stays definer-owned, volatile, `search_path` pinned,
not executable by public/anon/authenticated/service_role. Source oracles (labelled catalog-source, not behavior): no
`pattern_version_not_active`; inactive nested pattern raises `subject_not_submittable`; `canonical_source_unavailable` always has
the `{"domain"}` DETAIL and no bare raise remains; hash mismatch raises `VALIDATION_FAILED` with `["/subjectHash"]`.

## Test corrections

None. No existing assertion was changed. Only `plan(60)` to `plan(74)` and one `\ir` line in the governed-submit main file.

## Spec citations

BE03c 389 (CMS-03C-06 preconditions, 422 at `/subjectHash`, 409 else), 1259 (error matrix), 1304 (pattern tokens scoped to
CMS-03C-02/12/15), 1313-1314 (machinery rows, `canonical_source_unavailable` with `details.domain`), 1375, 1611, 306-313 (digest
tuple, `lifecycle`), FE03 1115; 03a CMS-03A-05 (registration accepts literal `supported`); DEC-180 R5 and G11; reviews:
`review-governed-worker-p1.md` rulings 1-3, `lane-pattern-def-report.md` Requests 1, `review-taxonomy-def.md` section 3b.

## Open items / BOUNDARY

- Not proven behaviorally here (needs producers not promoted): defect 2 end to end (a pattern whose nested pattern left `active`
  after the parent draft was created: needs pattern-def producers plus governed retire, 09) and defect 3 end to end
  (taxonomy with an unbuilt declared domain: taxonomy-def suite 060 #1061-1065 already asserts the DETAIL; it passes on any stage that
  includes `040100` or 030500). Source oracles stand in until a combined run.
- OBSERVATION for root (not changed, outside this lane): `cms_template_block_digest` (20260927200000, line 353) emits
  `"lifecycle": current_lifecycle`, i.e. JSON null for a block with no lifecycle event, whereas BE03c 306-313 and 03a make
  `lifecycle` the registry enum (`supported` at registration) and the pattern producer folds `supported`. Stored template digests
  contain null today; changing it would invalidate recomputation of every stored template digest, so it needs a deliberate
  decision (spec fix or a migrated recompute), not a patch from this lane.
- Latent hardening note: the digest loop takes `FOR SHARE` on registry rows; it ran without privilege error in R4-R7
  (the definer already holds what it needs), so no grant change was needed.
- The byte-order discrimination in the digest test assumes the database default collation differs from `C` for punctuation;
  if the stack default is already `C`, the ordering assertion cannot distinguish a lost `collate "C"` (it would still catch a
  lost ORDER BY or DISTINCT).
- Memory capture (root decides): candidates are the digest-null `lifecycle` divergence (anti-pattern: a producer and a recompute
  folding the same tuple differently), and "a never-run branch hides further defects behind its first error" (fixing 42P10
  exposed lifecycle null).

## Requests to root

1. Combined staged run (pattern-def + taxonomy-def + governed-fix WIP, plus governed 07/08/09 when ready) of: pattern-def suite
   (#50-#52, #198, #243-#244 should now pass with `040000`; #25/#52 agreement witnesses depend on the lifecycle fix), taxonomy-def
   suite 060, and a NEW behavioral case I propose for defect 2: pattern parent draft created over an active nested child, child
   retired through governed retire, submit of the parent must be `P0001 subject_not_submittable` (never `pattern_version_not_active`),
   no review row, parent still `draft`. I did not copy another lane's helpers into this lane's suite.
2. Promote `040000` and `040100` after the lanes whose objects they patch (they only need the already-promoted `300400`/`300820`
   bodies; they do not depend on pattern-def or taxonomy-def). If 030500 was already promoted, `040100` composes with it (R7).
   Otherwise drop 030500 from the promotion set: its patch is folded into `040100`.
3. Worker side (review finding 4c, not mine): add the missing test that a `VALIDATION_FAILED` `["/subjectHash"]` raise maps to 422
   `GOVERNED_REVIEW_VALIDATION_FAILED` `/subjectHash`; SQL now produces that raise (`governed-review-refusals` fixture).
4. Decide the template-digest `lifecycle` null observation above.
5. Populated-DB witness is not needed for these two migrations (function bodies only, no DDL or data change); the idempotent
   re-apply path (anchors absent, replacements present) is reasoned, not run.
