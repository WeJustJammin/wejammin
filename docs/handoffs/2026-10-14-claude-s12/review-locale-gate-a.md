# Independent review — `claude_s12_locale_gate_a` (DEC-192 locale approval gate phases)

Reviewer: independent adversarial (did not author). Clock `2026-10-15T17:09Z`. HEAD `b16edb54`. Read-only; no DB.
Target report `lane-locale-gate-a-report.md` SHA-256 `d7b804ed…cb4918` (verified).

## Verdict basis
SQL and spec cascade are correct and match DEC-192 exactly. One of the 23 new assertions is vacuous for the
property it names (stale outranks approval), so the precedence clause DEC-192 restates is not proven by the
suite. Remaining findings are minor (comment accuracy, fixture realism, spec-internal gap, one wrong count).

## Findings
1. `supabase/tests/phase_02_slice_12_locale_gate/001-gate.sqlinc:222-223` — major (test) — "stale outranks the
   approval check at scheduled execution" runs on fr2, which is APPROVED (line 116). With the approval check moved
   above the stale branch in 050600:66-72, fr2 still passes approval and still returns `no_fallback_stale`: the
   mutation survives the whole suite (the older publish twin at :220-221 has the same flaw). Missing > approval is
   proven (fr1, a draft, at :100 and :224); stale > approval is proven nowhere; missing > stale is unprovable with
   the single `legal` no_fallback field. BE03c :1658 now promises "missing outranking stale outranking approval"
   and the report claims "stale (fr2) … outrank the approval check". Fix: assert a NOT-approved stale revision
   after the :215 source edit, e.g. `l12g_gate(fr3 or fr4, 'execute')` = `failed/no_fallback_stale/1` (fr3/fr4
   were translated against `Legal two`); plan +1. Missing > stale: say so in the report or add a second
   no_fallback field; do not claim it.
2. `001-gate.sqlinc:193-199` — minor (fixture realism) — fr7 gets an `active` publish lineage row although it was
   never reviewed; no producer creates that state (CMS-03B-09 needs the approved review, and this gate refuses
   publish of an unapproved variant). It is inserted through `h11r_raw_insert`, which disables user triggers
   (`phase_02_slice_11_helpers/002-reviews.sqlinc:146-160`); the lane-rules never-list names "insert active rows
   directly". It mirrors the Slice 11 precedent (`phase_02_slice_11_helpers_effective_state.sql:221-240`, "no review
   needed") and E2 makes `published` first-match, so the oracle is unaffected. Fix: `h11r_approved` fr7 before
   the lineage insert (assertions and mutation power unchanged); reword the report's "no trigger was disabled by
   this lane's code" (the helper it calls does). fr6 is fine: approved review + pending schedule is reachable and
   uses exactly the Slice 11 :153-168 builder and override set.
3. `supabase/migrations-wip/locale-gate/20261014050600_cms_locale_no_fallback_gate.sql:17-20` — minor (comment) —
   "defense in depth against a schedule whose review was invalidated without cancellation" cannot occur: E2 rule 2
   (`scheduled`, `20261005017540…:51-56`) outranks the review rules, so a live schedule with an invalidated review
   stays `scheduled` and is admitted; the executor already blocks that case itself (`20261005017740…` step 2',
   `approval_invalidated`) before the execute preflight, where the schedule is `executing`. The execute branch is
   reachable only by a direct call (report Open item 2 says so honestly). Behavior equals DEC-192; reword only.
4. `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md:1436` — minor (spec-internal) — Derived
   variant state says "`approved` and `published` show `approved`", omitting `scheduled`, while 050400:30 maps
   `scheduled`→`approved` and the new changelog row :1741 claims the derived state "already shows a scheduled
   revision as approved". Not caused by this lane (pre-existing text) but the changelog now asserts an
   alignment the spec text lacks. Root ruling: add `scheduled` to :1436 (consistency edit outside DEC-192's
   literal text) or soften the changelog sentence.
5. Report §Runs row 3 — minor (claim) — "828 ok, 1 not ok, 1 abort": TAP `alt-staged-locale-gate-125847-2424149`
   has 803 `ok` + 1 `not ok` (prove `Files=27, Tests=804`), related_authority aborted after 13. Classification
   and conclusion are right; the count is wrong.
6. Nit: 050600:1-2 cite BE03c 1391/1397; the paragraph is now :1434. Matrix row AC240 cites `BE03c:1369, 1377`.

## SQL (050600 gate, 050700 unchanged)
- :41-44 phase whitelist submit|schedule|publish|execute; :64-67 missing then stale (unchanged); :68-72 approval
  check exactly when `p_phase in ('schedule','publish','execute')`, variant row exists, and E2 ∉
  {approved, scheduled, published}; submit falls through to `passed`. Matches DEC-192 and BE03c :1434.
- E2 values (017540:5-16) are exhaustive: admitted set = the three that 050400:28-33 shows `approved`; draft,
  submitted, rejected refused. Gate and derived state now agree.
- Security: `stable`, `security definer`, `search_path = ''`, owner `wejammin_cms_definer`, revoke from public,
  anon, authenticated, service_role; gate test #3 (`h11_private_definer`) green. Byte before/after diff not
  possible (untracked file, no prior copy on disk); manifests show 050600 `915e00d1…`→`d0fe7fea…` between runs 1
  and 2 and 050700 `2718715b…` constant in all four runs; report hashes match disk.
- Executor: the execute preflight runs the full registry (017570 loop; BE03b :1818/:1898), and
  criteria_publish_gates #33 shows the locale category is evaluated at execute.

## Tests
- TAP description diff, pre-change suite (`alt-staged-locale-gate-171245`, plan 36) vs GREEN run 2 (plan 59):
  exactly one replaced (old #21 execute "scheduled by construction" skip → fr2-draft execute fails) and 23 added;
  51 explicit + 8 include assertions = 59. The replaced oracle is DEC-192-required (a draft at execute must
  fail) and is a strengthening, not a weakening; approved/scheduled passes were added beside it as F4 asks.
- RED run 1: exactly #20, #29, #34, #39, #40 failed, for the right reason (old code skipped execute, refused
  scheduled). GREEN run 2: 59/59, `Result: PASS`. TAP hashes match the report.
- Mutation check (by reading): drop `execute` → #20/#29/#34; drop `scheduled` → fr6 ×3; drop `published` → fr7
  ×3; drop `approved` → fr2 ×3; add `submit` → fr3/fr4 submit (and :104); approval above missing → :100, :224;
  approval above stale → survives (Finding 1). Bogus phase → `INVALID_REQUEST` covered.

## Spec cascade
- BE03c :1434 (provider paragraph), :1658 (tests line), :1741 (changelog): wording equals DEC-192; no other
  `locale_variant_not_approved` statement in BE03c. FE03 (:889, :2665) and IA03 (:49, :70, :501) state blocking
  but no gate timing; correctly left alone.
- P2-S12-AC-240: `git diff --word-diff` vs HEAD shows the identical three insertions in tracker, `phase-2.md` and
  the depth-floor matrix; tracker and phase-2 bodies byte-equal up to the source links (links untouched).
  Clause = DEC-192, nothing more. Acceptance section now `d44800a1…` (verified); reversing the one substitution
  reproduces `9950eb5d…` (root's claim value); 0 checked boxes; phase-2.md `18239bcc…` and matrix `6b7c115b…`
  match the report and the Dispatch Log.

## Pre-existing failures
- Run 4 (lane `none`, manifest `wip=0`) reproduces owner_integrity #13 and the related_authority abort at :158
  (`cms_related_content_rules_max_candidates_check`). Promoted `20261014060000` (check at :70-72) is absent from
  the 2026-10-14 17:12 manifest and present in runs 3/4; HEAD fixtures lack `max_candidates`. Not caused by this
  lane. Both fixtures were since repaired by another lane (mtime 13:04, after run 4 at 13:01).
- Known reds green in run 3: helpers_preflight #14/#94, criteria_publish_gates #32/#33 (verified in TAP).

## To reach CLEAR
Finding 1 (one non-vacuous stale-over-approval assertion, one run). Findings 2-6 are optional or root rulings;
050600/050700 are behaviorally ready to promote as they stand.

VERDICT: PARTIAL
