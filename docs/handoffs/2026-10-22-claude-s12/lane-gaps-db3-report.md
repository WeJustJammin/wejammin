# Lane claude_s12_gaps_db3 report

## Status
GREEN for everything written; PARTIAL against the brief (6 rows: AC-292 and AC-023 closed, AC-079 written and awaiting root's apispec run, AC-143 closed only as a labelled seam, AC-056 and AC-072 end in a named BOUNDARY). HEAD cd89d54c, branch `claude/phase2-slice12`. No WIP migration was needed (no product defect found), so `supabase/migrations-wip/gaps-db3/` does not exist. No existing file was edited; no untracked file was edited in place (no tar backup needed).

## Scope
Rows AC-056, AC-292, AC-072, AC-143, AC-023, AC-079 of `briefs/gaps-wave4.md`. Scratch `/tmp/claude-1000/-home-rob-Projects-WeJammin/2663dcb2-f742-450b-97cd-0e849cede6cc/scratchpad/claude_s12_gaps_db3/`.

## Per-row outcome

| Criterion | Clause (current ledger index) | Outcome | Identity |
|---|---|---|---|
| AC-056 | 9 "answers a changed acting party" | PARTIAL / BOUNDARY (spec ruling) | `supabase/tests/phase_02_slice_12_gaps_db3_locale_party.sql` lines 77, 79, 90, 98, 106, 121. At the entry point the changed party is the concealed 404 NOT_FOUND, never the stored response, nothing written; the party-bound IDEMPOTENCY_MISMATCH is proven at the reservation primitive over the real stored key (line 98), with the same bytes under the original party completing (line 106) and a different actor being its own binding (121/125) |
| AC-292 | 2 "or scope does not gain replay authority." | PROVEN | `supabase/tests/phase_02_slice_12_gaps_db3_entry_party.sql` lines 103, 105, 108, 115: one actor with cms.author in two organizations reuses a completed CMS-03B-10 key under the second party and meets 409 IDEMPOTENCY_MISMATCH (no entry, receipt byte-identical); control: the original party replays. Actor member: existing `gaps_entry_default.sql` lines 150, 154, 156 (db2) |
| AC-072 | 4 "a separation-of-duties violation (the submitter" | BOUNDARY (unreachable) | no test. See below |
| AC-143 | 2 "the subject (`scheduled` with an equal hash)" | PROVEN AS LABELLED SEAM only | `supabase/tests/phase_02_slice_12_gaps_db3_schedule_subject.sql` lines 71, 134, 149 (+ controls 119, 155): review approved at its version, locked subject read substituted to a non-scheduled state / a differing hash -> approval_invalidated, review untouched, subject blocked, no event, one audit |
| AC-023 | 2 "/allowlisted" | PROVEN (owner-scope reading) | `supabase/tests/phase_02_slice_12_gaps_db3_template_owner.sql` lines 45, 51, 55 (+ control 67): an ACTIVE type with an ACTIVE version of another owner is VALIDATION_FAILED, alone and in a list |
| AC-079 | 9 "and Tier 2" (revoke half) | WRITTEN, NOT RUN | `tests/postgrest/phase-02-slice-12-latency-governed-revoke.apispec.ts` line 105 (assertion 129): root runs it |

## Files (all new)

| Path | Lines | SHA-256 |
|---|---|---|
| `supabase/tests/phase_02_slice_12_gaps_db3_template_owner.sql` | 72 | `ca4b861586011a21f3b8756b64f06217b03b9b2b163f5dae28baec65f643f155` |
| `supabase/tests/phase_02_slice_12_gaps_db3_locale_party.sql` | 128 | `c8e2b54bc79fad464aefffed5791300ebeedd603182275e36e5a679e4e67a5e9` |
| `supabase/tests/phase_02_slice_12_gaps_db3_entry_party.sql` | 118 | `4ad87171714cb8adebe14738f4814d19cdab28dffecc11180988270e30f6ac35` |
| `supabase/tests/phase_02_slice_12_gaps_db3_schedule_subject.sql` | 160 | `bae0c1496201e2b04222785dbee2b961296945af82824d1c1c37d23d5b056b6d` |
| `tests/postgrest/phase-02-slice-12-latency-governed-revoke.apispec.ts` | 138 | `3ae3858bde16ef6a6d90eb2118b6936bf3837e469401aec4c4ddd8a1f6a73196` |
| `docs/handoffs/2026-10-22-claude-s12/recite3/db3-proposals.json` | - | see final message |

eslint --max-warnings=0 and prettier --check clean on the apispec (no tsconfig project covers tests/postgrest; an ad hoc tsc showed only the environment's missing node/@wejammin module errors, identical to the existing apispecs).

## Runs

| Run | Time | Plan | Result | TAP |
|---|---|---|---|---|
| run1 (staged ALT runner, lane none, 4 new files, one run) | queued 21:32, lock 22:27, reset ok 22:28, done ~22:30 | no_plan x4: 13 + 15 + 10 + 20 | Files=4, Tests=58, all pass, fail=0, pg_prove exit 0 | `.lane-logs/alt-staged-none-213238-480936.tap`, SHA-256 `8bfa53bbcebad5139543c81818813f91c13419b4c408052af9ff13a58b1a02f9` |

No failure and no harness abort, so there was no second run. The apispec and vitest were not run (rules).

## Spec citations
BE03c 149 (key binding, DEC-235), 380 (compatibleTypeIds), 407 (owner-scope wording of the sibling pattern row), 1672 (indistinguishable 404). Code: `20260930150000_cms_idempotency_business_hash.sql` (fingerprint = request hash + resolved party), `20260927580000` lines 94-106 (CMS-03C-04 visibility and owner = acting party before `cms_reserve`), `20260927590000` lines 31-42 (CMS-03B-10 reserves right after the capability check), `20261013100200:120-132` (template type membership), `20261014070600` step 3 (executor OR of four conditions), `20261014010200` and `20261013300600` (SoD).

## Open items / BOUNDARY
1. AC-056 (spec ruling for root). BE03c 149 says a changed server-resolved acting party under the same key returns 409. CMS-03C-04 is addressed by entryId and answers the concealed 404 for an entry outside the acting party BEFORE it reserves the key, so the 409 is unreachable at that entry point (it is reachable on CMS-03B-10, which reserves before resolving the target: AC-292). The tests prove that no replay authority is gained and that the key fingerprint binds the party. Choices: amend BE03c 149 to "where the target is in the caller's scope; otherwise the concealed 404" (recommended: reservation-before-concealment would let a caller probe existence), or change the command to reserve first. I wrote no RED test: the behaviour is the order BE03c 149 itself lists (visibility, capability, assignment, idempotency).
2. AC-072 clause 4 (submitter). A submitter cannot hold an assignment: `cms_governed_assignment_guard` raises reviewer_not_eligible for reviewer = submitted_by (20261013300600:166-168), so does `cms_assign_governed_reviewer` (20261014010100:188-192); `submitted_by` is immutable (guard 20261013300500); the decision RPC answers capability_missing to anyone without an active assignment (20261014010200:97-107) BEFORE its separation_of_duties check (:165). The token is unreachable for submitter and creator alike. Existing identities cover the reachable outcomes: `governed_assignment/030-refusals.sqlinc` el-submitter, `governed_decision` c4. Root splits it like the creator part.
3. AC-143 clause "scheduled with an equal hash" is a SEAM proof (the AC-083 shape: `cms_governed_subject_resolve` renamed aside, a transparent wrapper alters state or contentHash only for the locked read, only while GUC gap.fault names it, restored byte for byte, restore asserted). The control at line 71 proves the review disjuncts are false, so only the subject disjuncts can differ. If root's rule bars citing seam proofs the clause reverts to BOUNDARY (hash immutable; all state moves also move the review or schedule). The adjacent "the policy basis" clause of AC-143 is not mine and could use the same wrapper on `cms_governed_policy_basis`, but the executor reaches the basis only through `cms_governed_activation_verdict` after these checks.
4. AC-023: BE03c 380 names no allowlist object. The proof reads "allowlisted" as the owner scope that BE03c 407 states for the sibling CMS-03C-12 and `cms_define_template` enforces. Root decides whether that reading closes the clause.
5. AC-079: the brief row says "revoke"; clause 3 of the ledger is the word "revoke" in "unchanged on create and revoke" (untimed, untouched). The apispec targets clause 9 "and Tier 2". Population: 27 assignments over two reviews (16 and 11 active) revoked in order, because `measure`'s check is synchronous and a re-assign between samples would sit inside the timed region.
6. PAT-031 (context-cleared SECURITY DEFINER): the AC-292 file selects each caller through `s09d_session` (clears the session/RPC GUCs per call); the AC-056 file changes the GUC party per call with `s10_rpc_as` and the primitive is called by the test-admin like the template_authority precedent. The party-B primitive (MISMATCH) differs from the party-A control (completed) with identical bytes, so a stale session cannot explain it.

## Test corrections
None.

## Requests to root
- Run `tests/postgrest/phase-02-slice-12-latency-governed-revoke.apispec.ts` on the quiet host right after `pnpm db:reset` (commits fixtures; reset again afterwards) and take the receipt.
- Rule on the AC-056 BE03c 149 wording (item 1) and on citing a seam proof for AC-143 (item 3).
- Feed `recite3/db3-proposals.json` to the next refutation.
