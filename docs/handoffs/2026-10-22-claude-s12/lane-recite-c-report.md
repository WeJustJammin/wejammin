# Lane claude_s12_recite_c report (P2-S12-AC-125 .. AC-214)

## Status
GREEN (proposals complete and validated; nothing applied to any ledger). Read-only lane: only this report and
`docs/handoffs/2026-10-22-claude-s12/recite/c-proposals.json` were written in the repository.

## Scope and method
- 90 criteria (ledgers 072-142, 143-213, 214-285), 224 clauses. Three read-only Sonnet sub-lanes (c1: 125-150, c2: 151-180, c3: 181-214) read
  the clause text, spec and test bodies and wrote one proposal file per criterion; I merged them and validated the merge.
- Mechanical checks (scratch `/tmp/claude-1000/-home-rob-Projects-WeJammin/2663dcb2-f742-450b-97cd-0e849cede6cc/scratchpad/claude_s12_recite_c/validate.mjs`, `prox.mjs`): clause texts verbatim vs the ledgers; every vitest citation (new and existing) is `passed`
  in vitest-all.json / uniq8.json; every apispec/dbspec/Playwright title exists in static source extraction; every pgTAP description is a literal
  in the cited file (collapsed whitespace) unless marked computed; every evidence line number exists and sits within 60 lines of the cited pgTAP description;
  status logic (a clause with a named gap is NOT counted as proven); no test is the sole proof of a clause for more than one criterion inside this range.
- I read a sample of pgTAP citations myself (AC-204 governed_recheck/030-person.sqlinc:30-40, AC-213 linked_scan/040-bounds.sqlinc:44-52,
  AC-137/142 evidence): they assert what the evidence says.
- No supabase, docker, db, race, Vitest or Playwright process was started by this lane. No repository file other than the two above was touched.

## Files
- `docs/handoffs/2026-10-22-claude-s12/recite/c-proposals.json` SHA-256 be1a712936f9897e916ac5043a196e86caa357bb113571dcb7d63d7c6008a247
- Scratch (not in repo): `/tmp/claude-1000/-home-rob-Projects-WeJammin/2663dcb2-f742-450b-97cd-0e849cede6cc/scratchpad/claude_s12_recite_c/` (per-criterion files out-c1/ out-c2/ out-c3/, validators, generator scripts).

## Counts
- Proposed status: verified 47, partial 15, unverified 28 (ledger today: 2 verified, 28 partial, 60 unverified).
  - verified: 125,127,130,131,135,136,137,139,140,142,149,150,151,153,154,156,157,160,162,163,165-168,170-180,182-185,188,192,203,204,206,212,213,214
  - partial: 126,128,129,132,133,134,138,141,159,161,164,169,193,207,211
  - unverified: 143-148,152,155,158,181,186,187,189-191,194-202,205,208-210
- Clauses newly cited: 178 clauses carry new citations (1193 new citation entries; most are pgTAP assertions, many with computed descriptions marked computed:true).
- Clauses with a named gap: 51 (50 are flagged needsSplit: the new citations prove a real part of the clause but not all of it. The guard cannot represent
  that, so root must split such a clause into verbatim sub-clauses, cite the proven part, leave the rest uncited. Until then those criteria are proposed
  as partial/unverified).
- Gaps by layer (clause level, coarse): pgTAP/database 36, Worker/web/contract vitest 6, Playwright 1, race 2, other 6
  (missing consumers that do not exist yet: AC-152, 155, 158; server retry policy DEC-211 AC-169; performance benchmark AC-133).
- Stale existing citations: 0 (every existing citation in the range resolves to a passing test / existing source identity).
- Doubtful existing citations (5, still cited as present, root should decide):
  - AC-128 clauses 1 and 2: Worker production-boundary tests "preserves exact taxonomy catalog RPC code TAXONOMY_NOT_FOUND / TAXONOMY_VERSION_CONFLICT" feed tokens
    that no migration raises (create raises NOT_FOUND / CONFLICT / IDEMPOTENCY_MISMATCH). They prove pass-through, not the real token mapping.
  - AC-161 clause 0 (tenure not yet started) and clause 3 (generic no-direct-grant sweep): partial proof only.
  - AC-207 clause 1: the retire preflight test asserts template_not_active, the clause names WITHDRAWN.

## Spec versus implementation mismatches found
- AC-132/134 (CMS-03C-17): spec says an absent vocabulary is 404; implementation answers an empty 200 page for an absent vocabulary/type/field and 404 only for a hidden owner
  (supabase selector `050-selector.sqlinc:74-76`).
- AC-138/141 (CMS-03C-18): spec says the match function is consumed by `cms_act_taxonomy_term` and the activation preflight; only `cms_term_overlap_check` calls it, the
  preflight reads registry provider_state directly.

## Principal gaps (details in each proposal's gap field)
- Consumers that do not exist: Shard 04 delivery projection / Slice 11 related-content recheck for CMS-03C-20/21 (AC-152, 155, 158).
- Governed review domain rules (AC-189-211): pattern key grammar beyond `selector`, second-owner pattern keys, pattern lineage partial-index predicate, pattern submit gates,
  template/pattern activate-or-schedule resolver and digest failures, governed table schema and closed subject_kind, direct UPDATE of lifecycle columns, policy basis tie-breaks,
  taxonomy submit/activate provider gates, lost-race `activation_conflict` two-session race (race layer), publish-time bound re-enforcement (AC-211).
- Cursor binding (AC-186/187): replay as another actor/party and natural expiry.
- Schedule execution (AC-143-148): execute-time re-reads of subject hash/policy basis/canonical providers, grant ending by valid_through, SKIP LOCKED claim (race), MFA-never-rechecked.

## Five weakest citations still proposed (reviewers start here)
1. `supabase/tests/phase_02_slice_12_taxonomy_terms_canonical.sql:213` (AC-137 clause 0): "per former" gives no_match; a positive whitespace-collapse case is not observable.
2. `tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts:65` (x-slo-tier): proves the declared Tier class only, used for the Tier clauses of AC-162, 168, 174, 180.
3. `supabase/tests/phase_02_slice_12_governed_schedule/010-setup.sqlinc:54-61` (AC-142 clause 0): four has_function checks stand in for "exactly two RPCs".
4. `supabase/tests/phase_02_slice_12_governed_recheck/075-digest-locks.sqlinc` (AC-193/208/209): fault-injection case cited only to show activation reaches the digest recompute.
5. `apps/worker/src/cms-composition/taxonomy-definition-write.test.ts:76-84` (AC-126 clause 1): a null session returning 401 is the only "verified human" proof.
Also: `apps/web/src/pages/app/cms-content-modeling/taxonomies/taxonomy-pages.test.ts:80` (AC-182, page wiring by source text).

## Runs
None (read-only lane).

## Test corrections
None.

## Requests to root
- Apply proposals after the next commit, splitting the 50 needsSplit clauses (list in the JSON) rather than citing them whole.
- Have the refutation population start with the five weakest above and the 5 doubtExisting entries.
- Several evidence strings in AC-148/149/129/131-135/145 lack a line number (21 entries); reviewers can locate them by title.
