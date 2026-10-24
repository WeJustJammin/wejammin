# Independent review — lane `claude_s12_governed_fix_sql` (staged-runner lane `governed-fix`)

- Reviewer: independent, adversarial, read-only; static only (no DB, no runner). Model Fable 5.1.
- Date: 2026-10-14. Worktree `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`, HEAD `b16edb54`.
- Target report: `docs/handoffs/2026-10-14-claude-s12/lane-governed-fix-report.md`, SHA-256
  `c523bbc0fd0af289ef6dfa7ae9471fb13542a9158583b9c3e610f85c2b09b0c7` — verified by `sha256sum`.
- Brief: `briefs/governed-fix.md`; rules: `lane-rules.md`; template: `briefs/review-template.md`.

## Status

The two WIP migrations are correct, minimal, idempotent, composable and spec-conformant; the four briefed
defects (plus the fifth the author found) are fixed with RED→GREEN evidence I re-verified in the TAP files;
the 60 original governed-submit assertions are byte-identical (reconstruction hash matches). Defect 3 is
now proven behaviorally by root's combined run (not only by source oracles). The SQL and tests are
promotable as they stand.

The author's report carries two substantive false claims that root must not act on: Request 4 / the
"OBSERVATION for root" reads a superseded definition of `cms_template_block_digest` (the live one already
folds `supported`), and Request 1's prediction that pattern-def #50–52 "should now pass with 040000" is
contradicted by the combined run for a cause that is neither 040000 nor "pattern-def storage" (findings F1,
F2). Minor test-convention items follow (F3–F7).

## 1. Claims re-verified (author report vs disk)

| Claim | Result |
| --- | --- |
| 10 file SHA-256 values in the Files table | all 10 MATCH (`sha256sum`) |
| Line counts | 9 of 10 match; `phase_02_slice_12_governed_submit.sql` is **296** lines, table says 295 (295 is the pre-change count) — F6 |
| Pre-change governed-submit main reconstructs to `318717a7…`, 295 lines, by reverting `plan(74)`→`plan(60)` and deleting the one `\ir` | MATCH: my reconstruction (scratchpad) hashes `318717a7f17bc2170f6d68994466ded43ef401b5db5ddb6e023d0436117c8253`, 295 lines; `diff` shows exactly those two lines |
| "Every one of the original 60 assertions is byte-identical" | TRUE for the main file (above) and for the five owned includes: `000/005/010/015/020` hash `3b25ff67…`, `d0b4d985…`, `e123571f…`, `7eaf30b0…`, `d5226e03…`, identical to the frozen manifest in `lane-governed-review-report.md:21-27`; `support/jwt-claims.sqlinc` `1e197105…` unchanged |
| Seven TAP SHA-256 values (R1–R7) | all 7 MATCH |
| R6 final 92/92 | TAP `…064141-3141995.tap`: `1..74` (line 4), `1..18` (line 148), 92 `ok`, 0 `not ok`, `Files=2, Tests=92`, `Result: PASS`; manifest line 1 `wip=2`, lines 375-376 the final hashes `ff72249d…`/`0e25c13b…` |
| R1 RED (no WIP): submit #63/#64/#68 fail; fix suite aborts on 42P10 | TAP `…063558`: lines 99-111 exactly those three; line 123 `ERROR: for SELECT DISTINCT, ORDER BY expressions must appear in select list`, `not ok 3` |
| R2 RED hardened: #4-#8 source oracles, #9-#14 digest, harness abort `text \|\| "char"` | TAP `…063710`: lines 25-53 exactly; line 3 the abort |
| R3 #9/#10/#12 `VALIDATION_FAILED` + #17 harness | TAP `…063750` lines 138-156 — consistent with calling the digest outside `app.cms_rpc` (see F2 for why this matters cross-lane) |
| R4 #10/#12 wrong hash (lifecycle null) | TAP `…063840` lines 27-33 |
| R7 composition probe staged 030500 | manifest `…064224` line 375: `f41cf1c7…  20261014030500_…` (equals the taxonomy lane's recorded SHA, `lane-taxonomy-def-report.md:31`) with the two finals; TAP 92/92, source oracles #6/#7 ok |
| "copy kept in the lane scratchpad" of deleted 030500 | NOT VERIFIABLE: no file named `20261014030500_*` exists anywhere on this host (`find /`); patch 2 can be compared with 030500 only through `review-taxonomy-def.md:103-112` (same anchor, same "first declared domain whose provider is not `built`, in declaration order", same marker) and R7 |
| "R5 differed from R6 only by the `applied_markers` guard" | NOT VERIFIABLE (the `6910402e…` cut is not on disk); not load-bearing |
| "30-hash-refusal: 14 assertions" | TRUE (counted); the include header says 15 — F6 |
| governed-fix suite 18 assertions | TRUE: 000 ×2, 005 ×6, 010 ×10 |

## 2. Anchored-patch technique (both migrations)

Read against the live bodies `20261013300400:85-129` (digest) and `20261013300820:30-247` (submit; 300830
redefines nothing). Each anchor is a verbatim substring with exact indentation and occurs exactly once:

| Migration | Anchor | Live occurrence | Replacement correct? |
| --- | --- | --- | --- |
| 040000 a1 (`:24-28`) | the 4-line `select distinct … order by closure.block_key collate "C", closure.block_version\n` | `300400:96-99` only (the `dependency_refs` copy at `:51-53` is another function) | yes: DISTINCT in a derived table `reached`, outer `order by reached.block_key collate "C", reached.block_version` — same keys, same collation, same direction; loop reads `reference.block_key/block_version` unchanged |
| 040000 a2 (`:29`) | `        'lifecycle', current_lifecycle));` | `300400:124` only | yes: `coalesce(current_lifecycle, 'supported')` — same value the guard at `:115` already assumes |
| 040100 a1 (`:24`) | `raise exception 'pattern_version_not_active' using errcode = 'P0001';` | `300820:159` only | yes |
| 040100 a2 (`:25`) | `raise exception 'canonical_source_unavailable' using errcode = 'P0001';` | `300820:151` only | yes: DETAIL `{"domain": <first declared domain, by ordinality, whose `cms_canonical_domain_current` row is not `built`>}`; the predicate is the same one the `exists` guard at `:145-150` uses, so the subquery is never NULL when the raise fires; `cms_canonical_domain_current(text)` returns ≤1 row (`300100:82-94`) |
| 040100 a3 (`:26-28`) | `  if subject->>'state' is distinct from 'draft'\n     or subject->>'contentHash' is distinct from subject_hash then\n` | `300820:127-128` only | yes: hash branch raises `VALIDATION_FAILED` DETAIL `'["/subjectHash"]'`; state branch keeps the original `:129-130` raise |

Invariants both DO blocks enforce: shape guard (`prolang` plpgsql, `prorettype`, `prosecdef`); occurrence count
exactly 1 else 55000 unless already applied; `patched = live.prosrc` → return; `CREATE OR REPLACE` rebuilt with
the identical header (`volatile security definer set search_path = ''`, body via `%L` so quotes round-trip);
`to_jsonb(pg_proc) - 'prosrc'` compared before/after — this covers `oid`, `proowner`, `proacl`, `proconfig`,
`provolatile`, `prosecdef`, `proparallel`, argument types. Comment is preserved by `CREATE OR REPLACE`. Both
are idempotent on re-run (anchors 0, replacements/markers present → no-op). No grant statement, no DDL, no
data change. Precedent `300820:11-22, 250-261` uses the same before/after comparison.

Composition with 030500 (if root had promoted it first): anchor 2 then occurs 0 times and the marker
`jsonb_build_object('domain'` is present → skipped (R7). Composition with a LATER full-body redefinition: a
later timestamp runs after 040100 and simply must carry the fixes; the tripwires are `005-submit-source`
#2-#6 and `030-hash-refusal`. No other WIP lane (governed-a, pattern-def, taxonomy-def) defines either patched
function (`grep` over `supabase/migrations-wip/`: one comment mention only, `pattern-def/020300:12`).

Weakness (F4): the step-1 "already applied" fallback in `040100:45,67-68` is the replacement text
`raise exception 'subject_not_submittable' using errcode = 'P0001';`, which the UNPATCHED body already
contains six times (`300820:129,136,163,171,176,208`). So "anchor absent" is always accepted as "applied" for
patch 1 — vacuous as an idempotency proof (harmless today; see F4 for the hazard).

## 3. Route-registry clauses touched (CMS-03C-06)

| Clause | Spec | Implemented | Tested |
| --- | --- | --- | --- |
| `subjectHash` must equal stored `content_hash`, else 422 at `/subjectHash` | BE03c:389 (`(422 at /subjectHash)`), 1259 (422 column "subject hash/kind failure"), FE03:1115 ("422 hash mismatch") | `040100` patch 3 → `VALIDATION_FAILED` + DETAIL `["/subjectHash"]`; Worker: `rpc.ts:84-86` (not a Slice-12 reason) → `provider-fault-guard.ts:17-21` (P0001 carries a product token) → `mapCmsEditorialRpcFailure` → `errors.ts:181-185` `violationsFromDetailText` → `error-vocabulary.ts:51-57` `SAFE_POINTER` accepts `/subjectHash` → `response.ts:107-110` violations; catalog `error-catalog.ts:86` 422 `GOVERNED_REVIEW_VALIDATION_FAILED` | `030-hash-refusal.sqlinc` #2-#9 (wrong hash, cross-subject hash: token, DETAIL, no body, scoped stores identical incl. idempotency rows, zero live reviews) + positive control #10-#11; `005-submit-source` #6 (source). Worker test still missing (worker-p1 finding 4c; author Request 3) |
| subject must be `draft` with no live review, else 409 `subject_not_submittable` | BE03c:389, 1313 (table), 1259 (409 column) | unchanged `300820:129-137` (state branch now separate) | original #26-#28 (duplicate live) + new `030` #12-#13 (non-draft, correct hash) |
| hash-before-state evaluation order | BE03c:389 lists hash (422) before state (409); no explicit order | `040100` patch 3 (hash first) | NOT PINNED — no wrong-hash-on-non-draft case (F5) |
| pattern subject: every nested pattern `active` else refused; token belongs to 409 `subject_not_submittable`, never `pattern_version_not_active` | BE03c:1313 (submit precondition), 1304 ("`pattern_version_not_active` … are 422 on CMS-03C-02, CMS-03C-12 and CMS-03C-15"; "Each token is listed under exactly one status"), 1259 (06's 409 column: `subject_not_submittable`), DEC-180 R5 (decisions.md:5142); contract `refusals.ts:140-145` (06 publishes only `capability_missing`, `separation_of_duties`, `subject_not_submittable`, `canonical_source_unavailable`; a foreign token is 500 at `rpc.ts:88-93`) | `040100` patch 1 | `005-submit-source` #2-#3 (catalog-source only: token absent / nested-closure branch raises `subject_not_submittable`). Behavioral case needs pattern producers + CMS-03C-09 retire — not possible in any staged set yet (author Request 1 names the right case) |
| taxonomy subject: declared domain with an unbuilt provider → 422 `canonical_source_unavailable` with `details.domain` | BE03c:1314, 1375, 1611 (test list), FE03:1115, DEC-180 G11; contract `refusals.ts:259` (`domain` mandatory) and Worker `rpc.ts:98-106` (missing domain → 502) | `040100` patch 2 | `005-submit-source` #4-#5 (source) **and behaviorally** in root's combined run `…064427-3158036.tap` lines 1980-1984: taxonomy 060 #1061-#1065 "canonical-source refusal identifies its declared domain" all `ok` with only `040100` staged (manifest lines 395-396; no 030500 in that stage) |
| pattern digest: reachable, deduplicated tuples `{blockKey,blockVersion,releaseDigest,propsSchemaHash,rendererRef,lifecycle}` sorted by UTF-8 bytes of `blockKey` then numeric `blockVersion`, JCS SHA-256 | BE03c:306-313; `lifecycle` is the 03a safe-record member whose registered value is literal `supported` (BE03a:229, 1102, 1770) | `040000` a1 + a2; identical fold to the producer `pattern-def/020300:64-98` (same closure, same DISTINCT/ORDER BY, same `btrim`, same `coalesce(…, 'supported')`) and to the live template digest `20260927240000:50,86-93` | `010-digest` #1-#6 (evaluates; equals an independently built 4-tuple list in C order `fix-c < fix.b < fixa`; node-order independent; grandfathered `{nodes}` shape; empty = JCS(`[]`); missing block still `VALIDATION_FAILED`); R4→R5 proves the `supported` member is load-bearing; combined run #198 "child: prerequisite real governed submission" `ok` (line 681) is the end-to-end agreement witness through `300820:161-163` |
| template and taxonomy branches of the recompute unchanged | brief | structural: both anchors lie inside the `pattern_version` branch (`300400:95-126`); `:91-93` and `:128` untouched | `010-digest` #7 (template branch delegates — empty-slot case only) and #8 (taxonomy NULL); governed-submit #10 (`[]` digest) — see F7 |
| function identity: definer-owned, volatile, `search_path=""`, no API-role EXECUTE | 300400:263-273 | preserved (attribute compare) | `010-digest` #9-#10 (`proowner|prosecdef|provolatile|proconfig`; `aclexplode` + `has_function_privilege` for anon/authenticated/service_role) |

## 4. Security

- Ordering unchanged: structure (`:56-73`) → concealment NOT_FOUND (`:78-88`) → locks and capability 403
  (`:91-101`) → idempotency identity (`:103-124`) → the new 422 → 409 → kind checks → reserve. The 422 is
  reachable only by a caller who already passed concealment and holds the owner capability, so it discloses
  nothing a read would not. 403-vs-404 concealment is untouched.
- Refusals precede `cms_reserve` (`:183`): no idempotency row, audit or outbox write on a 422 — asserted by
  the `s12gov_scope` equality (`020-idempotency.sqlinc:11-25` covers the full subject row, reviews,
  dependencies, ALL idempotency rows, audit/outbox counts).
- DETAIL payloads: a constant pointer and a domain name from the closed six-member set — no PII, no ids.
- Grants: none added; ACL/owner/config proven unchanged by the DO-block comparison and by `010-digest` #10.
- `FOR SHARE` in the recompute loop (`300400:106`) runs under the definer; it executed on real registry rows in
  R5-R7, so the privilege exists; no change needed.

## 5. Tests

- `030-hash-refusal.sqlinc`: non-vacuous. `hashsubject` has `slots: []`, so the only `VALIDATION_FAILED`
  source is the hash branch and only that branch emits `["/subjectHash"]` (#2-#4); the cross-subject case uses
  another real stored hash (#8); positive control proves hash-specificity (#10-#11); non-draft control (#12-#13);
  role control over the four added calls (#14, `ordinal > 9` — the main file's nine-call control at `:289-292`
  is preserved by placing the include after it). Keys `0004/0005`, `0007-0010` are unique in the suite.
  `s12gov_idsnap`/`s12gov_scope` are created by `020-idempotency.sqlinc:9-11`, included at main `:288`, before `:293`.
- `010-digest.sqlinc`: the `fix_digest` wrapper sets `app.cms_rpc` for exactly one call and turns a raise into a
  comparable value (good: one defect cannot hide later assertions). Expected values are built from the stored
  rows, not from the function under test; they pin dedupe, byte order and `lifecycle: supported`. The byte-order
  oracle discriminates only if the database default collation is not `C`/`C.UTF-8` (author's caveat stands; it
  still catches a lost DISTINCT or ORDER BY).
- `005-submit-source.sqlinc` (catalog-source oracles): meaningful as tripwires — each pair cannot pass on the
  unpatched body (R2 #4-#8 failed) nor on an empty body (#1 length control; absent-old/present-new pairs) —
  but vacuous as behavioral proof: they prove text, not reachability or status mapping. Defect 3 now has the
  behavioral proof (section 3); defect 2 does not and cannot until CMS-03C-09 exists.
- No mocks, no skipped tests, no weakened oracle; the only changes to existing files are `plan(74)` and one `\ir`.

## 6. Answers to the brief's specific questions

1. **Anchored technique**: sound (section 2). Exactly-once anchors, all non-body attributes compared, idempotent,
   fail-loud on drift, composes with 030500. One vacuous fallback (F4).
2. **Digest fix preserves template/taxonomy digests exactly — proof present?** Structural proof is complete (the
   anchors are inside the pattern branch; the template branch is a one-line delegation to a different,
   untouched function). Test proof is thin: only the empty template digest passes through the recompute anywhere
   in S12 (F7). Taxonomy NULL is asserted (#8).
3. **`lifecycle: supported` — citation and consistency**: BE03c:306-313 folds the 03a safe-record member;
   BE03a:229 ("registration accepts only literal `supported`"), 1102 (`lifecycle: z.literal('supported')`),
   1770 (enum `supported|deprecated|withdrawn`) — `null` is not a member. The producer folds
   `coalesce(block_lifecycle, 'supported')` (`020300:96`) and the live template digest folds the same
   (`20260927240000:50,91`). The fix is correct and necessary; R4→R5 shows the recompute was unequal without it.
4. **Hash-before-state vs BE03c:389**: 389 names the hash clause (422) before the state clause (409); the spec
   prescribes no evaluation order. The choice is defensible, documented in the report, and not a security issue
   (section 4), but it is untested (F5).
5. **Source oracles for defects 2 and 3**: meaningful as regression tripwires, vacuous as behavior (section 5).
   Defect 3 is now behaviorally proven by the combined run; defect 2 remains source-only by necessity.
6. **Author's Request 4 (`cms_template_block_digest` emits `"lifecycle": null`)**: FALSE on disk. The author cites
   `20260927200000:353`, but that body was replaced by `20260927220000` and then by
   `20260927240000_cms_template_digest_supported_lifecycle.sql`, whose live body sets
   `current_lifecycle := coalesce(current_lifecycle, 'supported')` (`:50`) before folding `'lifecycle',
   current_lifecycle` (`:91`). `phase_02_slice_12_template_authority.sql:612-619` already pins a real
   single-block template digest with `'lifecycle', 'supported'`. Stored template digests therefore do not
   "contain null today"; template, pattern producer and the fixed governed recompute now agree. Had the
   divergence been real, the blast radius would have been every stored `block_registry_digest` AND
   `content_hash` (`20260927200000:470-471` folds the digest into the content hash), i.e. every template
   subject hash, frozen review hash and 03b preflight expectation — so the author's instinct to escalate was
   right in form; the premise is simply stale. No decision is needed; the memory candidate "a producer and a
   recompute folding the same tuple differently" has no instance.

## 7. Findings

F1 — `docs/handoffs/2026-10-14-claude-s12/lane-governed-fix-report.md` ("Open items" bullet 2; "Requests to
root" 4; memory candidate 1) — **major (report accuracy)** — States that the live `cms_template_block_digest`
hashes `"lifecycle": null` and that stored template digests contain null, citing `20260927200000:353`; the live
definition is `20260927240000:50,91` and folds `supported`. — Why it matters: it asks root for a spec change or
a data migration over every template's digest and content hash to fix a divergence that does not exist, and it
proposes a false anti-pattern for memory. — Fix: strike the observation, Request 4 and the memory candidate;
state that template (`20260927240000`), pattern producer (`020300:96`) and recompute (`040000` a2) agree.

F2 — `lane-governed-fix-report.md` ("Requests to root" 1: "#50-#52, #198, #243-#244 should now pass with
`040000`") and, downstream, `CLAUDE-STATE.md:117-119` ("interaction of governed-fix `040000` with pattern-def
storage?") — **major (cross-lane diagnosis)** — Root's combined run `…064427-3158036.tap` (manifest lines
395-396 stage the final `040000`/`040100`) shows #50-#52 `have: ERROR:P0001:VALIDATION_FAILED`, #243-#244
`want: NULL`. Cause of #50-#52: `phase_02_slice_12_pattern_definition/025-agreement.sqlinc:16-22` executes
`cms_governed_current_digest` as the harness user WITHOUT `app.cms_rpc`; the block registry is forced-RLS with
the single policy `cms_rpc_context_valid()` (`20260902080000:1600-1608`; the table is in the forced-RLS list at
`:2199-2211`), so the definer sees no
registry row and `300400:107-108` raises `VALIDATION_FAILED` — exactly the author's own R3 symptom, cured in R4
by the `fix_digest` wrapper (`010-digest.sqlinc:14`). #243-#244 fail because the nested parents were never
created (#210-#213 downstream of missing CMS-03C-09). Meanwhile #198 `ok` (line 681) — the real governed
submit of a pattern draft, which sets the GUC and compares the recompute with the stored digest at
`300820:161-163` — is the end-to-end proof that `040000` works and agrees with the producer. — Why it matters:
the report's prediction is wrong as stated and the state file is about to send an integration lane after a
non-existent `040000`×storage interaction. — Fix: governed-fix report corrects Request 1 to "#198 passes;
#50-#52 need the pattern-def harness to set `app.cms_rpc` as `fix_digest` does; #243-#244 need CMS-03C-09";
pattern-def lane adds `set_config('app.cms_rpc','true',true)` around the one call in `s12pd_governed_digest`
(as its own `070-storage.sqlinc:26,137` already does) and restores it; root amends CLAUDE-STATE.

F3 — `supabase/tests/phase_02_slice_12_governed_fix.sql:10-15` — **minor (convention)** — `select no_plan()`
and no `\set ON_ERROR_STOP on`, whereas the four sibling governed suites all declare a fixed plan and set
ON_ERROR_STOP (`governed_submit.sql:23,30`, `governed_assignment.sql:11,18`, `governed_decision.sql:11,18`,
`governed_reads.sql:10,17`). — Why it matters: a mistyped or moved `\ir` target is a psql meta-command error,
not a transaction abort; with `no_plan()` its assertions vanish silently and `finish()` still prints a
matching plan. — Fix: `select plan(18);` and `\set ON_ERROR_STOP on` before the first `\ir`.

F4 — `supabase/migrations-wip/governed-fix/20261014040100_cms_submit_governed_review_refusals.sql:45,67-68` —
**minor (robustness)** — For patch 1 `applied_markers[1]` is NULL, so the fallback is the replacement text,
which the unpatched body already contains (`300820:129,136,163,171,176,208`); "anchor absent" is therefore
always accepted as "already applied". — Why it matters: a future full-body redefinition that reintroduces
`pattern_version_not_active` with different whitespace would be skipped silently instead of failing 55000 (the
pgTAP tripwire `005-submit-source` #2 would still catch it in a run that includes this suite). — Fix: use the
absence of the string `pattern_version_not_active` as the applied condition for step 1 (and, symmetrically,
the presence of `detail = '["/subjectHash"]'` for step 3, which is already specific enough).

F5 — `supabase/tests/phase_02_slice_12_governed_submit/030-hash-refusal.sqlinc:61-69` — **minor (coverage)** —
The chosen evaluation order (hash before state, report "Ordering decision") has no discriminating case: the
non-draft control uses the correct hash. — Why it matters: the order is a behavior the report documents; a
later rewrite that flips it would pass this suite. — Fix: one more call (`hashsubject` in review, hash
`repeat('e', 64)`, key `0011`) asserting `VALIDATION_FAILED` + `["/subjectHash"]`, `plan(75)`, and the role
control's `count(*) = 5`.

F6 — docs/accuracy, three spots — **minor** — (a) `030-hash-refusal.sqlinc:4` says "Plan contribution: 15";
it is 14 (README and report say 14). (b) `phase_02_slice_12_governed_fix.sql:5` and
`005-submit-source.sqlinc:26` reference `030-refusals.sqlinc`; the file is `030-hash-refusal.sqlinc`. (c) Report
Files table: main file is 296 lines, not 295. — Fix: edit the three strings.

F7 — `supabase/tests/phase_02_slice_12_governed_fix/010-digest.sqlinc:68-71` — **minor (proof depth)** — The
"template branch unchanged" assertion passes `slots: []`, so both sides are JCS(`[]`); no non-empty template
digest passes through `cms_governed_current_digest` in any S12 suite (`governed_submit.sql:155` is also `[]`).
The structural argument (section 2) is sufficient for this patch, so this is not a defect in the fix. — Fix
(optional): one template with a real registered block and a compatible type whose renderer manifest lists it
(the `template_authority.sql:596-619` fixture shape), asserting recompute = stored column.

Observations (no finding): 030500's bytes are not on this host, so patch 2 is equivalent to 030500 by the
taxonomy review's description and by R7, not by byte comparison; the governed-fix digest loop raises `CONFLICT`
for a deprecated block where the producer raises `VALIDATION_FAILED` (`300400:115-117` vs `020300:87-89`) — a
pre-existing cross-helper inconsistency already escalated by `review-pattern-def.md` F2, outside this lane.

## 8. Recommendations to root

1. Promote `20261014040000` and `20261014040100` as they are (no code change required by any finding); do not
   promote 030500 (folded; R7 proves composition either way).
2. Reject the author's Request 4 and the first memory candidate (F1); amend CLAUDE-STATE's combined-run
   diagnosis (F2) and route the `app.cms_rpc` harness fix to the pattern-def lane.
3. Optional hardening in a follow-up (F3, F5 first; F4, F6, F7 when the suites are next touched).
4. Worker test for the 422 `/subjectHash` mapping (worker-p1 4c; author Request 3) remains open on the Worker side.

VERDICT: PARTIAL
