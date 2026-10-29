# Review `claude_s12_refute3` - refutation of the gap-wave-4 proposals (lanes `gaps-db3`, `gaps-db4`) and review of the gaps-db4 WIP migration

Reviewer: `claude_s12_refute3` (separate population; I wrote none of the tests, proposals or the migration). 2026-10-29. Worktree
`/home/rob/.codex/worktrees/phase2-slice12/WeJammin`, HEAD `cd89d54c` (gap-wave files untracked or modified).
Read: `briefs/recite3-refutation.md` (with the root note at its end: DEC-237 settles the AC-210/223 order), `2026-10-14-claude-s12/lane-rules.md`,
`recite3/db3-proposals.json` (SHA-256 `e1671cf0...1435`), `recite3/db4-proposals.json` (`db6a0a4c...cdd91`), `lane-gaps-db3-report.md` (`7b331346...2d11`),
`lane-gaps-db4-report.md` (`a8b51cc9...e3c2`), `scripts/evidence/README.md` and `ledger-guard-lib.mjs`, the current ledger fragments, BE03c / BE03b / BE00 lines,
the nine cited test files, the lanes' ALT TAP files, and the production migrations they exercise.
Output: `recite3/refutation.json` (11 entries, one per proposed criterion, ascending) and this report. Read-only: no supabase, docker, db, race, Vitest or
Playwright run; the only run evidence is TAP already on disk. Scratch (builders, identity / TAP / duplicate checks, guard simulation, a JS port of one regex for
mutation testing): `/tmp/claude-1000/-home-rob-Projects-WeJammin/2663dcb2-f742-450b-97cd-0e849cede6cc/scratchpad/claude_s12_refute3/`.

Resume note. The coordinator's resume message said nothing of mine was on disk. In fact `recite3/refutation.json` was already complete (11 entries, written
2026-10-29 00:06) and the report was absent. I continued from the JSON instead of restarting, re-read the brief (its end note was added after launch),
re-checked that HEAD, the ledger, the specs, the lane files and the TAPs are unchanged since, and updated the AC-210 / AC-223 entries to treat DEC-237 as settled.

## 1. Verdict

**ACCEPT-WITH-DROPS (mandatory conditions).** WIP migration: **PROMOTE-WITH-CONDITIONS** (section 6).

48 of 98 proposed citations are DROP (49 %: db3 7/23 = 30 %, db4 41/75 = 55 %) and one is a FIX. That is far above the 5 % ACCEPT band, so this is not an
ACCEPT. I did not call it REJECT because the over-claiming is one habit, not rotten proof: the lanes cited every tagged assertion of a file, and the 48 DROPs are
19 no-effect or control assertions, 12 catalog / source proxies (all in one file), 9 adjacent rules, 7 confounded titles or masked probes and 1 pin on an absent
caller. Every clause the lanes closed keeps at least one sound, mutation-sensitive proof; the two honest BOUNDARIES are AC-072 c4 and AC-155 part 1. Seven criteria become
`verified` (222/70/4 -> 229/64/3 verified/partial/unverified, guard simulation 0 problems); one (AC-155) must be overruled from the lane's `verified` to `partial`.

Mandatory conditions: (1) apply the 48 DROPs and the AC-225 FIX; (2) split AC-155 c0 and use the BOUNDARY text of section 8; (3) add to AC-210 the activation
assertion and the two Worker rows, and cite AC-086 c4 with them; (4) add the AC-143 guardrail citations and apply AC-143 and AC-056 BY CLAUSE TEXT, not by the
proposals' indices (both are wrong, section 4 item 9); (5) remove the stale AC-072 c4 citation; (6) before AC-256 counts: decide the registry reading, resolve the
WIP conditions of section 6 and add the one missing probe; (7) a passed receipt for the AC-079 revoke apispec, which nobody has run.

## 2. Counts

| | n | share |
|---|---|---|
| Proposed citations reviewed, every one (97 pgTAP, 1 Vitest apispec; 96 distinct identities) | 98 | |
| KEEP | 49 | 50.0 % |
| DROP | 48 | 49.0 % |
| FIX (kept for status, with a stated change) | 1 | 1.0 % |
| Criteria with at least one DROP | 8 of 11 | |
| Missed tests found (identity-checked) | 8 (+1 cross-criterion note) | AC-143 x2, AC-155 x2, AC-210 x3, AC-223 x1 optional; AC-086 c4 |
| Splits | 0 proposed, 1 advised (AC-155 c0); AC-143 c3 stays unsplit | |

| Criterion | proposed | KEEP | DROP | FIX | lane status | my status |
|---|---|---|---|---|---|---|
| AC-023 | 4 | 3 | 1 | 0 | verified | verified |
| AC-056 | 6 | 2 | 4 | 0 | partial | **verified** |
| AC-072 | 0 | - | - | - | partial | partial |
| AC-079 | 1 | 1 | 0 | 0 | verified | verified (needs a passed receipt) |
| AC-143 | 5 | 5 | 0 | 0 | partial | partial |
| AC-155 | 16 | 7 | 9 | 0 | verified (with a limitation) | **partial** |
| AC-210 | 7 | 2 | 5 | 0 | verified | verified (with 3 added) |
| AC-223 | 5 | 1 | 4 | 0 | verified | verified |
| AC-225 | 10 | 3 | 6 | 1 | verified | verified after the FIX |
| AC-256 | 37 | 20 | 17 | 0 | verified (with a limitation) | verified, see section 6 |
| AC-292 | 7 | 5 | 2 | 0 | verified | verified |

DROP classes (same schema as the earlier rounds):

| Class | n | Where |
|---|---|---|
| NOEFFECT: a store-unchanged, control or oracle-control assertion filed under a clause that does not state it | 19 | AC-023 :67; 056 :90 :106; 155 :78 :105 :108 :112; 210 :150 :173; 223 :137 :141 :173; 225 :43 :59 :61 :63 :65; 292 :108 :115 |
| SOURCE: catalog or source-text proxy where the same file has the behavioural probe | 12 | AC-256 :91 :97 :100 :102 :108 :110 :112 :114 :180 :183 :196 :201 |
| ADJACENT: asserts a neighbouring rule or mechanism | 9 | AC-056 :98 :121; 155 :55 :97; 210 :114 :118 :122; 256 :95 :221 |
| CONFOUNDED: the title says more than the body, or the denial is not isolated to the clause's cause | 7 | AC-155 :72 :74 (masked by schema USAGE); 223 :153; 225 :53; 256 :106 :185 :187 |
| PROOFGAP: passes because the clause's subject is unbuilt | 1 (+1 FIX) | AC-155 :82; FIX AC-225 :39 (detector blind to the boolean structure) |

## 3. Status changes (lane -> mine)

| Criterion | Change | Precondition |
|---|---|---|
| AC-056 | partial -> verified | apply the two KEEPs to **c10** (DEC-236 text); the lane's BOUNDARY (a 409 is unreachable at CMS-03C-04) is superseded by DEC-236 |
| AC-223 | verified (as lane) | none beyond DEC-237, which stands |
| AC-210 | verified (as lane) | with the added activation assertion and the two Worker rows; DEC-237 stands |
| AC-225 | verified (as lane) | the line-39 detector is tightened (FIX); until then it proves shape, not the lock set |
| AC-292, AC-023 | verified (as lane) | none (AC-023: record the reading, section 5.2) |
| AC-256 | verified (as lane) | WIP promoted with a BE03c 1624 amendment, or lines 136/138 removed from citations AND file; plus the missing probe |
| AC-079 | verified (as lane) | a passed receipt of the new revoke apispec on a quiet host after `pnpm db:reset`; otherwise remove that one citation |
| AC-155 | verified -> **partial** | c0 split; part 1 (the two unbuilt registered callers) is a BOUNDARY; the lane's own `verified` + non-empty limitation is rejected by the guard |
| AC-143, AC-072 | partial (as lane) | AC-143 c3 now cited (labelled seam), c4 open; AC-072 c4 and c5 both BOUNDARY |

Ledger totals with all of the above applied (guard simulation with the real `evaluateLedger`, synthetic passing receipts, the AC-155 split and, in a second
run, the AC-086 c4 additions): 0 problems both times (tiling, status / limitation rules, sole-proof limit, duplicates), recomputed statuses equal the JSON
(0 mismatches), totals 222/70/4 -> **229/64/3** (verified/partial/unverified).

## 4. The most serious findings

1. **AC-155 c0 "verified" is not honest (and the proposal contradicts the guard).** The clause names two registered callers (the Shard 04 delivery projection and
   the Slice 11 related-content recheck); neither exists as a database caller, so the positive requirement cannot be exercised. Owner-only ACL plus an empty
   caller inventory proves only that nobody else can execute it. The proposal also files `proposedStatus: verified` with a non-empty `proposedLimitation`; the
   guard rejects that (verified = every clause cited and no limitation). The same inconsistency is in AC-256. Ruling in 5.3.
2. **The WIP "defect" is a spec ambiguity, not a promoted-vs-spec divergence.** The promoted CHECK is character for character the CHECK BE03c line 1624 prints for
   this table. "Non-null exactly when built" exists only in the tracker criterion and reads jointly or distributively. The migration is a deliberate tightening
   beyond the spec's DDL and needs a spec amendment and a decision (section 6).
3. **Four real-role denial citations are masked by the schema** (AC-155 :72 :74, AC-256 :185 :187). `anon` and `authenticated` hold no USAGE on `platform_private`
   (`20260830044317:17`; asserted by `database_harness.sql:185`, `phase_02_slice_08_boundaries.sql:15-16`), so those calls fail with 42501 at the schema whatever
   the function or table grants say. The files' inverse controls re-run the ACL probe, never the real-role call. The `service_role` probes are not masked
   (`service_role` has USAGE) and are kept.
4. **"Nothing changed" after a raised refusal is blind (5 citations: AC-056 :90, AC-292 :108, AC-210 :150, AC-223 :137 and :141).** Every refusal runs inside a
   nested EXCEPTION block (`l12_try`, `g3e_call`, `s12ga_rpc`) that rolls back its effects, and a raised RPC commits nothing anyway, so the equalities hold for any
   refusal and cannot observe whether the key was reserved before the check. The one place a changed receipt would be visible is the kept db2 assertion
   (`gaps_entry_default.sql:155-156`), where the other actor's call SUCCEEDS. The order claims are proved by the exact tokens instead (item 10).
5. **AC-225's source oracle is blind to the boolean structure of the lock statement.** I ported the detector regex 1:1 and ran it on the live source: replacing
   either `or` by `and`, or inserting `and false`, keeps it GREEN while the statement no longer locks the survivor and the retired term; descending order and
   `FOR SHARE` are rejected. The `[^;]*` wildcards are the cause. FIX: require the literal `or` connectives and add the two inverse controls. Also :53
   ("resolves exactly ... that the lock statement named") only checks that the source contains the substrings `termkey` and `survivorid`.
6. **AC-210 lacks its "Activating" half and its 422 transport.** The proposal cites the schedule refusal only; the activation refusal (:129) is cited under
   AC-223 alone. The "422 ... with details.domain" is a Worker fact: the proposal's gap note points to the AC-223 c1 token-mapping test, which is the
   CMS-03C-03 term-action port, a different operation. The right rows exist (`ACTIVATION_TABLE` 'canonical_source_unavailable {domain}', driven for activate
   by `governed-review-ops-refusals.test.ts:13-25` and for schedule by `governed-activation-refusals.test.ts:19-34`) and become admissible now that the DB
   raises the token on this operation (DEC-226 rule 4). The same four tests also close **AC-086 c4**, which has 0 citations.
7. **AC-256's catalog proxies are redundant, and one is provably blind.** The assertion "a CHECK ties ... both non-null exactly when built" (:106) is three LIKE
   fragments of the constraint text: in run 1 it was `ok 7` while the half-set probes 18 and 19 were `not ok` on the same constraint. Twelve SOURCE drops in
   total, each with a behavioural probe in the file. **Missing probe:** no probe refuses an UNBUILT row that keeps BOTH members, the first case anyone reads into
   "exactly when built"; a CHECK that enforced only "built implies both set" would pass every cited probe.
8. **AC-223 :153 over-claims.** "a repeat ... the refusal was not stored as a replayable outcome" repeats with `s12gb_act('d-activate-again', ...)`, whose
   idempotency key is `'s12ga-' || label` (`000-world.sqlinc:38-42`): a different key from the first call, so no stored outcome could be hit.
9. **Two proposals carry stale clause indices.** db3 gives AC-143 index 2 (the ledger's index 2 is "re-reading the review"; the subject clause is index 3) and AC-056
   index 9 with the pre-DEC-236 text "answers a changed acting party" (current c9 is "answers a changed body, path or version ..."; the clause is c10). An
   index-keyed apply would land the seam tests under the review clause and the party tests under the body clause. Apply by text.
10. **AC-056 c10 is proved by two assertions, and the order is proved by the token.** The stored key exists (setup) with a party-A fingerprint, so any order that
    reserves first yields OK or IDEMPOTENCY_MISMATCH, never NOT_FOUND. `20261002167000:100-102` raises NOT_FOUND before `cms_reserve` at `:110`. The primitive-level
    MISMATCH (:98), its control (:106) and the other-actor control (:121) are mechanism and adjacent rules: good tests, wrong clause.
11. **AC-072 c4 is an unreachable BOUNDARY (I agree)** and the current outcome-only citation must leave c4 (section 5.4).
12. **AC-292: both members of "scope" are now proved**, acting party (409, db3) and actor (scoped miss, db2). A third member exists that nobody drives: the
    authority-bearing `context.actingContextId` is in the fingerprint (`20260930150000:27-52`). Root's round-2 ruling defined scope as two members.
13. **AC-079 revoke apispec is sound but unrun, and its counted samples never run at 16 active.** 3 warm-ups plus 24 samples over 27 assignments on reviews of
    16 and 11, so the counted samples run at 13..1 (review a) and 11..1 (review b); the 16-, 15- and 14-active revokes are the discarded warm-ups. "Up to the
    limit" is literally true; the figure is not the worst-case population (neither is the sibling create bench).
14. **AC-210 quantifier "every declared canonical domain".** Every cited run declares exactly one domain (role). A mutant that checks only the first declared domain,
    or only role, passes all of it; `cms_governed_first_unbuilt_domain` is used only by this verdict. Recommend one two-domain case (also pins the declaration-order
    choice of `details.domain`). Not a DROP: the citations prove what they show.

## 5. Rulings

### 5.1 Seam ruling: AC-143 "the subject (`scheduled` with an equal hash)" - citable, four points hold

Mechanism: `cms_governed_subject_resolve` is renamed aside and wrapped; the wrapper alters `state` (or `contentHash`) only when `p_lock` is true and the GUC
`gap.fault` names it; restored by renaming back (`gaps_db3_schedule_subject.sql:75-111`). Same shape and standing as AC-083 (`gaps_db1_recheck.sql`).

| Point | Verdict and evidence |
|---|---|
| (a) substitutes only the read under test | Yes. The executor's decision (`20261014070600:156-157`) consumes exactly one locked read (`:134`). The block helpers run after it and read the UNLOCKED variant (`cms_governed_block_scheduled_subject`, `20261014070100:132-140`, `p_lock` default false), so they see the real `scheduled` state and move the subject to blocked. `cms_governed_lock_lineage_active` does not read the subject; `cms_governed_lock_graph` only receives the substituted jsonb to take locks. Executor, guards and tables are the unmodified product. |
| (b) a control shows every other disjunct is false | Yes for the review disjuncts (`ok 14`, :68-71: every claimed schedule has its review approved at exactly `schedule.expected_version`; the post-state of each run shows the review still approved at version 2) and for the wrapper itself (`ok 15`, :115-119: wrapper installed, no fault, the schedule completes). The stored-hash = frozen-hash control (:150-152) exists for the hash run only; for the state run equality follows from the review-insert guard and immutability, not from an assertion. Hardening, not blocking. |
| (c) restored byte for byte and asserted | Yes: `md5(prosrc)`, owner and ACL of the same `pg_proc` row renamed back (:100-111,154), and no renamed-aside reader left (:156-157). |
| (d) the clause's behaviour on that state is what is asserted | Yes: `blocked` / `approval_invalidated`, schedule blocked with the lease cleared, review untouched (approved, version 2), subject blocked, 0 events, 1 audit record. Mutation: deleting the subject-state disjunct, or the hash disjunct, lets the executor reach the activation switch and the assertion fails. |

Per citation: :134 (state) KEEP, :149 (hash) KEEP, and the three guardrails KEEP as **seam guardrails**: :71 (b), :119 (a), :155 (c). They are not proof of the
clause; citing them pins them (the guard demands a receipt for every cited identity), so a later edit cannot remove an isolation control or the restoration
silently. Add the two remaining guardrails (:150-152 hash control, :156-157 no renamed-aside reader) as missed tests. Consistency flag: refute2-a DROPped the
equivalent restoration control of AC-083 as hygiene; if root adopts guardrail pinning it should add that control to AC-083 c2. Status stays partial: c4 "the
policy basis" is uncited and is closable with the same technique on `cms_governed_policy_basis` (`20261013300400:195-199`, reached at fire through
`cms_governed_activation_verdict`). No other proposal uses a seam: the forged tenure / grant rows (AC-056, AC-292) and the registry rows (AC-210, AC-223) are
labelled state fixtures with precedent (`01-actors.sqlinc:61,79`; `099-registry-drift`, `gaps_db1_schedule_fire`) and substitute no production object.

### 5.2 Reading ruling: AC-023 "/allowlisted" = the owner scope - accepted, closes the clause

BE03c 380 says "each active/allowlisted ContentTypeVersion family" and names no allowlist object (grep of BE03c, BE03a / BE03b and IA03: "allowlist" occurs
only for domain bindings, taxonomy rules, projections and diagnostic fields). BE03c 407 states the sibling membership as "each the id of an active content type
of the caller's owner scope". New evidence beyond the lane's two lines: **BE03c 1526** says the pattern `compatibleTypeIds` is "(OD-2, mirroring templates;
1-64 active content type ids of the owner scope)": the spec itself declares the pattern row to mirror the template row. The live check
(`20261013100200:120-132`) enforces exactly owner + active + an active version. The three kept assertions refuse an active, versioned type of another owner
alone and inside an otherwise valid list in both positions (`ok 7, 9, 10`), with the owned type of the same shape accepted (`ok 12`, not cited). Condition:
record the reading (amend BE03c 380 to the 407 / 1526 wording or log a decision); if the owner meant a separate per-type allowlist the clause reopens.

### 5.3 AC-155 c0 with the registered callers not built - part of the clause is a BOUNDARY

"Verified" is not honest (finding 1). Advised split, tiling c0 verbatim (the single space between the parts is a guard separator; simulated, 0 problems), the
shape AC-150 uses for its unbuilt Shard 04 consumer:

- part 0 `CMS-03C-21 is executable only by the registered non-browser callers`: cite :53 (owner-only `aclexplode`), :70 (effective EXECUTE of every non-superuser
  role outside the definer's membership: empty), :76 (`service_role` denied 42501, not masked) and :91 (no `platform_api` body references it).
- part 1 `(the Shard 04 delivery projection and the Slice 11 related-content recheck`: uncited BOUNDARY.

The "only" side is proved; the positive side (the registered callers execute it as the definer) is not. :82 (empty caller inventory) is a PROOFGAP: it passes because
the callers do not exist and goes red the day one is built. c2 is cited by :53 :57 :59 :70 :76 and is verified on its own. Existing c1 citation 2
(`002-shape-and-grants.sqlinc`, a no-wrapper assertion filed under "PUBLIC, anon, authenticated") belongs next to :91.

### 5.4 AC-072 c4 "a separation-of-duties violation (the submitter" - agree, an unreachable BOUNDARY

The only assignment producer refuses reviewer = submitter or subject creator with `reviewer_not_eligible` (`20261014010100:188-192`, sole insert site `:223`), as does
the BEFORE INSERT guard (`20261013300600:164-169`); `submitted_by` lies outside `lifecycle_keys` (`:35-37`) so the review guard answers IMMUTABLE_RECORD
(`:69-71`); the decision RPC answers `capability_missing` at step 3 (`20261014010200:104-111`) before the `separation_of_duties` raise at step 7 (`:166`). The same
token is raised by the decision table's BEFORE INSERT guard (`20261013300600:204-206`) and proved by direct inserts (`gaps_governed/020-persistence-probes.sqlinc:68-70`,
cited under AC-252), but that is the persistence layer, not CMS-03C-07's 403. Root: remove `governed_decision/020-gates.sqlinc:82` ('fb-submitter' =
`capability_missing`) from c4 and keep it under c3, where it belongs; rewrite the limitation to name c4 and c5 together (section 8).

### 5.5 AC-056 against the second clause (DEC-236)

c10 = "and never replays to a changed acting party (an entry outside its scope is the concealed 404, answered before the key is reserved)." KEEP :77 (never served
the stored response) and :79 (exactly `P0001:NOT_FOUND`; order proof, finding 10). DROP :90 (blind), :98 (primitive mismatch: the mechanism the clause says is not the
answer here), :106 (control), :121 (actor-distinct binding, no longer in the AC-056 text). Apply to c10 by text. With c10 cited, AC-056 is verified.

### 5.6 AC-210 / AC-223: citations whose proof depends on the order (settled by DEC-237, BE03c step (5) amended)

| Citation | Depends on provider-first order? | Verdict |
|---|---|---|
| AC-223 c0 / AC-210 c0 activation refusal (db4 :129, `ok 17`) | yes: with the strict step order the same registry change is `dependency_changed` | KEEP, stands |
| AC-210 c0 schedule refusal (:145, `ok 20`) | yes, same reason | KEEP, stands |
| AC-210 c0 undeclared domain activates (:160) | no | KEEP |
| Worker rows 'canonical_source_unavailable {domain}' (added) | no | add |
| :137, :150 ("changes nothing") | would also fail under the strict order, but already blind | DROP |
| :114, :118, :122 (step-up, capability, CAS first) | no (earlier steps) | DROP, adjacent |

Residual risk is only a reversal of DEC-237 by the owner; then AC-210 and AC-223 are unreachable at activation again (the registry is versioned, so a provider
change is always a newer row). BE03c step (5) now also says the refusal "keeps the approval": that is carried by the outcome being a raise (a committed
invalidation is returned as a refusal envelope, never raised), which :129 already proves; :137 adds nothing.

## 6. The gaps-db4 WIP migration `20261029110000_cms_canonical_domain_registry_provider_pair.sql`

**Verdict: PROMOTE-WITH-CONDITIONS.** No grant, RLS, trigger or function change (one `ALTER TABLE ... ADD CONSTRAINT`).

Spec match. BE03c 1624 prints for `cms_canonical_domain_registry`: `CHECK((provider_state = 'built') = (provider_key IS NOT NULL AND provider_version IS NOT NULL))`
and `UNIQUE(domain,version)`; the promoted `cms_canonical_domain_registry_provider_check` (`20261013300100:33-35`) is that text. The WIP's header says BE03c "states
provider_key and provider_version are non-null exactly when built": that sentence is the tracker's (`phase-2.md:3360`), not BE03c's. With the added
`CHECK ((provider_key is null) = (provider_version is null))` the `provider_state` relationship is preserved and strengthened:

| state | key | version | promoted CHECK | + WIP |
|---|---|---|---|---|
| built | set | set | accept | accept |
| built | null | set / set / null / null | refuse | refuse |
| unbuilt | null | null | accept | accept |
| unbuilt | set | null | **accept** | refuse |
| unbuilt | null | set | **accept** | refuse |
| unbuilt | set | set | refuse | refuse |

So the two legal shapes remain (built with both, unbuilt with neither). The lane's RED tests (run 1 `ok 18/19` `not ok`) prove only that the promoted CHECK admits a half-set
unbuilt row, which BE03c's DDL permits and the tracker sentence can be read to forbid. The promoted table already carries tightenings the spec row does not list
(`provider_key` regex, `provider_version > 0`), so one more is in character, but it is a spec change.

Populated database. The six seed rows (role built `shard02.role_facet_assertion` v1; five unbuilt, key and version null) satisfy it; the table has no other
producer (no stored function inserts, no write grant); run 2's `supabase db reset` applied the migration over those rows without error
(`.lane-logs/alt-staged-gaps-db4-222821-886118.reset.log:572`, manifest SHA-256 `4c4d8290...ec0`); every existing test insert is both-null / unbuilt or both-set / built
(`taxonomy_terms_canonical.sql:259-267`, `gaps_db1_schedule_fire.sql:144`, `099-registry-drift.sqlinc:12`, `gaps_governed/070-canonical-recheck.sqlinc:32-34`, the db4 files).
`NOT VALID` + `VALIDATE` is not needed: six rows, a trivial scan under `lock_timeout 5s`.

Neighbours. Header style, `begin; set local lock_timeout; ... commit;`, a plain forward-only `add constraint` (as `20261002190000`) and the constraint name pattern match.
No anchors are needed (those are for function-source amendments). The closest promoted neighbour that adds a CHECK to stored rows,
`20261027100020_cms_pattern_key_reserved_nestable.sql` (V14-04, PAT-025), also has `set local statement_timeout`, a typed pre-check (SQLSTATE 55000 naming the count,
"never a bare 23514"), a post-verify and a populated witness. The WIP has none of them.

Conditions:
1. **Spec first (blocking).** Amend BE03c 1624 to add `CHECK((provider_key IS NULL) = (provider_version IS NULL))` (and the changelog), and log the distributive reading as a decision.
   If root or the owner prefers the joint reading, do NOT promote, and remove lines 136 and 138 from the citations AND from the test file (a cited file that is RED on the promoted schema is a guard
   problem).
2. **Convention parity (blocking, low risk).** Add `set local statement_timeout = '30s'`, a typed pre-check before the ALTER (`raise exception ... using errcode = '55000'` when a
   half-set row exists) and a post-verify (`convalidated`). A populated witness is recommended; the reset over the six seeds already exercises the real population.
3. Fix the header: cite BE03c 1624's literal CHECK and call this a tightening ("the DDL formula admits a half-set unbuilt pair; the criterion's sentence does not"), not a promoted defect.
4. Add the missing probe to `gaps_db4_registry.sql` (unbuilt row keeping both members, 23514); it passes today and makes "exactly" two-directional.
5. At promotion: manifest with the SHA-256, a `supabase/migrations/README.md` section, remove `supabase/migrations-wip/gaps-db4/`, re-run `gaps_db4_registry` and
   `taxonomy_terms_canonical` canonically.

## 7. Mechanical checks (scratchpad scripts)

| Check | Result |
|---|---|
| File SHA-256 of the 8 new SQL files, the apispec, the WIP migration and both proposal files | equal to the lanes' reports (12 / 12); file mtimes precede the run stamps (related_acl and the WIP: same second as run 2 stamp `222821`, and the TAP carries the corrected `ok 13` title) |
| Identities (`identity-check.mjs`) | 97 pgTAP citations: every title is one whole SQL string literal in a `.sql` entrypoint (none in a `.sqlinc`, none computed), unique in its file, trimmed, exactly one `ok` line in the newest TAP, and the evidence line lies inside the literal's lines. The one Vitest citation is a static describe + test path, unique, no `.only/.skip`, selected by the `vitest.postgrest.config.ts` glob |
| Cited files (`dups.mjs`) | the 9 cited pgTAP files: 0 duplicated descriptions, 0 skip / todo, 0 `not ok` in the newest run (run 1's three `not ok` are the superseded RED run) |
| Runs | db3 (stamp 213238, lane none): 4 files 58 / 58. db4 run 1 (213138): 106 tests, 3 `not ok` (registry 18, 19 = the WIP question; related_acl 13 = harness, corrected). db4 run 2 (222821, WIP applied): registry 47, related_acl 19, taxonomy_terms_canonical 62 = 128 / 128. merge_lock 15 / 15 and taxonomy_activation 25 / 25 only in run 1, files unchanged since. db2 `gaps_entry_default` (AC-292 actor member) `ok 54-56` in stamp 195321 |
| Guard simulation (`simulate.mjs`) | real `evaluateLedger`, current ledger + my KEEP / FIX + missed tests + AC-155 split: 0 problems; second run with the AC-086 c4 additions: 0 problems; statuses equal the JSON |
| Mutation of the AC-225 detector (`mergelock-mutants.mjs`) | live source, detector true, `for update` 1, `order by` 1; 3 of 5 shape-preserving mutants stay green (finding 5) |
| Code read | `cms_author_locale_variant` (`20261002167000`), `cms_reserve` / fingerprint (`20260930150000`), executor (`20261014070600`), verdict (`20261014070200`), activate RPC (`20261014070400`), decision RPC and guards, `cms_act_taxonomy_term` (`20261014190030`), registry (`20261013300100`), `cms_define_template` (`20261013100200`) |

## 8. Limitation texts to apply

* AC-072: 'Unproven (uncited clauses): "a separation-of-duties violation (the submitter" and "the subject creator) is 403": the decision RPC's separation_of_duties branch cannot be reached by a submitter or a creator - both are refused at assignment (reviewer_not_eligible) and never hold the assignment the decision RPC checks first; the 403 each receives is capability_missing, the answer of every unassigned reader; the table guard that raises the token is proved under AC-252 (BOUNDARY).'
* AC-143: 'Unproven (uncited clause): "the policy basis": BOUNDARY (db1/db3): a policy basis that changes between acceptance and fire is unreachable by any lawful state (frozen and current basis are both immutable); the fire-time recheck is reachable only through a labelled seam on cms_governed_policy_basis, not yet written. The clause "the subject (scheduled with an equal hash)" is proved by a labelled seam on the locked cms_governed_subject_resolve read (gaps_db3_schedule_subject.sql): its isolating controls and the byte-for-byte restoration are asserted in the same file.'
* AC-155: 'Unproven (uncited clause): "(the Shard 04 delivery projection and the Slice 11 related-content recheck": BOUNDARY (db4): neither registered caller exists as a database caller (no function calls platform_private.cms_related_content_public_targets), so the requirement that they execute it as the CMS definer under the CMS RPC context cannot be asserted; the owner-only ACL, the effective-privilege scan and the absence of any browser-reachable reference are proved.'
* AC-023, 056, 210, 223, 225, 256, 292: limitation becomes empty (all clauses cited), subject to the conditions of section 3.

## 9. Requests to root (ordered)

1. Apply `recite3/refutation.json` BY CLAUSE TEXT (AC-056 -> c10, AC-143 -> c3), with the AC-155 split, the AC-210 additions and the AC-086 c4 citations.
2. Decide the registry reading (recommend the distributive one, hence the BE03c 1624 amendment and a decision) and resolve the WIP conditions before AC-256's lines 136 / 138 count.
3. Record the AC-023 owner-scope reading (BE03c 380 wording or a decision).
4. Run `tests/postgrest/phase-02-slice-12-latency-governed-revoke.apispec.ts` on the quiet host right after `pnpm db:reset` (it commits fixtures; reset again afterwards) and take the receipt.
5. Next gap wave: tighten the AC-225 detector (FIX); the "unbuilt row keeping both members" probe; a two-domain AC-210 case; the AC-143 hash-equal control for the state run and a `cms_governed_policy_basis` seam for c4.
6. Consistency, out of scope here: the sibling persistence criteria AC-251..AC-255 cite the same catalog-text shapes that this round drops; the AC-083 restoration control is not pinned.
7. AC-225 opposed merges (A->B / B->A) remain a race module for root.

## 10. Evidence index

Output `docs/handoffs/2026-10-22-claude-s12/recite3/refutation.json` (per-citation reasons carry `path:line`, the TAP number and the mutation that would fail it). TAPs:
`.lane-logs/alt-staged-none-213238-480936.tap` (db3), `.lane-logs/alt-staged-none-213138-478231.tap` (db4 run 1), `.lane-logs/alt-staged-gaps-db4-222821-886118.tap` (db4 run 2),
`.lane-logs/alt-staged-taxonomy-integrity+gaps-db2+node-pointers+nestable-read+placement-perf-195321-139898.tap` (db2). Tests read in full: the four db3 files, the four db4 files,
`gaps_db1_template.sql` and its fixtures, `gaps_entry_default.sql` (AC-292 section), `governed_decision/020-gates.sqlinc`, `gaps_governed/020-persistence-probes.sqlinc`,
`governed_activation/000-world.sqlinc`, `locale_variant/000-helpers.sqlinc`, the new apispec and its support modules, the Worker token tables `governed-activation-tokens.test-support.ts`
and the two refusal tests.

## Verification round (2026-10-29, after the gaps-db4 fix round and DEC-238)

Same reviewer (`claude_s12_refute3`); I wrote none of the fixes. Inputs, all SHA-256 equal to the lane's `## Fix round` list (7 of 7): `lane-gaps-db4-report.md`
section "Fix round"; run-4 TAP `.lane-logs/alt-staged-gaps-db4-003722-1630371.tap` (`72837ac6...61f1`, 5 files, 186 / 186, the reset applied the WIP,
`reset.log:572`, manifest `e7251eaa...fd34`); `recite3/db4-proposals.json` (`bf7a7193...0aa9`, 94 citations); the four edited test files; the rewritten WIP
migration (`e7251eaa...fd34`); DEC-238 (`.memory/raw/events/2026-10-29.jsonl`) and BE03c 1624 (now carries the pair CHECK, changelog row 1928).
Output: `recite3/refutation-v2.json`: the five db4 entries, 94 citations, every current proposal judged exactly once against the current clause texts (0 unjudged,
0 extra), each tagged `vsV1` = carried / renamed / new. For the five db4 criteria v2 SUPERSEDES the db4 part of `refutation.json`; the db3 entries of v1 stand.
Read-only again: no run. Evidence beyond the TAP: the lane's pre-fix backup `scratchpad/claude_s12_gaps_db4/orig-003418.tar`, diffed to prove exactly what changed
(the carried assertions are byte-identical, only line numbers moved), and an independent JS port of the new AC-225 detectors run on the live source
(`scratchpad/claude_s12_refute3/v2/mergelock-v2.mjs`).

### V.1 Verdicts

* **WIP migration `20261029110000_cms_canonical_domain_registry_provider_pair.sql`: PROMOTE.** Every blocking condition of section 6 is met; the remaining items
  are non-blocking nits (V.3).
* **Fix round: all my mandatory db4 conditions are met** (V.2); two instrument gaps (witness controls) and four nits remain, none blocking.
* **Citations: 94 judged, KEEP 42, DROP 52, FIX 0** (see V.4). 66 are carried unchanged from v1 (34 KEEP, 32 DROP), 28 are new
  or renamed (8 KEEP, 20 DROP). The proposals file is again a file-wide candidate list (it re-proposes the 32 carried DROPs); root applies the JSON.
* Ledger totals with v1 (db3) + v2 (db4) applied, real `evaluateLedger` and synthetic passing receipts, with the AC-155 split and, in a second run, the AC-086 c4
  additions: **0 problems both times, statuses equal the JSON, totals 229 / 64 / 3** (unchanged from section 3).

### V.2 My conditions, one by one

| # | Condition | Verdict | Evidence |
|---|---|---|---|
| 1 | Spec first (amend BE03c 1624, log the reading) | MET | DEC-238 (option A); BE03c 1624 now lists `CHECK((provider_key IS NULL) = (provider_version IS NULL)) (DEC-238 ...)`; changelog row 1928 |
| 2 | WIP `statement_timeout` | MET | WIP `:13` (`set local statement_timeout = '30s'` beside `lock_timeout`) |
| 3 | WIP typed 55000 pre-check | MET | `:15-38`: counts rows where exactly one member is null (all rows, superseded included, which is the CHECK's scope), raises SQLSTATE 55000 naming the count; asserts the installed `provider_check` shape (regexes match `pg_get_constraintdef`'s `provider_state = 'built'::text` ... `IS NOT NULL`); refuses if the pair CHECK already exists. Syntax as the promoted neighbour's. The success path ran in run 4's reset |
| 4 | WIP post-verify | MET | `:44-55`: `convalidated` and both `IS NULL` fragments of the new constraint |
| 5 | WIP header | MET | `:1-10`: a TIGHTENING implementing 1624 as amended by DEC-238 and the ratified AC-256, prints the promoted formula, states exactly which shapes it admits and refuses, cites V14-04 / PAT-025 and the 20261027100020 convention; no longer claims BE03c said "exactly when built" |
| 6 | The unbuilt-both probe | MET | registry `:157-158` `{"provider_state":"unbuilt"}` (baseline key and version kept) refused 23514, TAP `ok 20`; refused by the promoted CHECK so it does not depend on the WIP; baseline and unbuilt-with-neither controls at `:143`, `:159`. Mutation: a one-directional CHECK accepts it |
| 7 | AC-225 detector fails on `or`->`and` / `and false` | MET | detector is a literal `strpos` (`merge_lock.sql:28-39`). My port on the live source: true; REJECTS both `or`->`and`, `and false` inside and before the alternatives, owner scope dropped, taxonomy scope inverted, `desc`, `FOR SHARE`, `FOR NO KEY UPDATE`, dropped `ORDER BY` (10 of 10). The new applier detector rejects its three mutants. Only dead code around the loop (inherent to a static oracle) still passes. Eight new controls, `ok 15-22` |
| 8 | Masked probes isolate the object privilege | MET | related_acl `:71-77` and registry `:204-210` grant schema USAGE first (rolled back); registry pins the exact message `42501:permission denied for table cms_canonical_domain_registry`; inverse controls (related_acl `:104-107` EXECUTE; registry `:215-219` INSERT + policy-function EXECUTE) make the SAME call run (`ok 17`, `ok 41`). Run 3 caught an incomplete control, run 4 green. The `service_role` probes were never masked |
| 9 | Write witnesses observe attempted writes in the rolled-back call; controls move them | MET BY CONSTRUCTION, TWO GAPS | six `a_g4_witness` BEFORE ROW triggers (`:63-91`) bump sequences; `nextval` survives the nested EXCEPTION rollbacks of `s12ga_rpc` / `g4_try`; every product trigger on the six tables (`cms_*_guard`, `outbox_guard`, `audit_append_only`, `idempotency_guard`) sorts after `a_g4_witness`, so a write the product then rejects is still counted. Controls move review, subject, outbox, audit (`ok 24`, real activation) and schedule (+ review, outbox; `ok 29`). GAP 1: the idempotency witness has no control anywhere (its one use, `ok 15`, could pass vacuously). GAP 2: no assertion shows a witness moving inside a call that is then ROLLED BACK; the property rests on documented sequence semantics. One line closes both: assert `g4_w('idem')` advanced across the `d-activate` refusal (`cms_reserve`, step 4, precedes the provider check, step 8, and is rolled back) |
| 10 | AC-210 two-domain case | MET | `:201-242`: role built (v3), instrument registered built (v2); four vocabularies declaring `['role','instrument']` approved while both are built (`ok 27`: 8 frozen dependencies); tm2 activates and tm4 is scheduled (the minimal-pair partners, `ok 28`); instrument, the SECOND declared domain, goes unbuilt (v3); tm1 activate and tm3 schedule are refused `canonical_source_unavailable#{"domain": "instrument"}` with role still built (`ok 30`, `31`). Kills the first-declared-only and role-only mutants. Residual: a last-declared-only mutant still passes |

### V.3 WIP migration: PROMOTE

What was verified: the migration text (`:11-57`); the success path under run 4's `supabase db reset` over the six seed rows; that its CHECK equals the one BE03c 1624 now prints;
that no existing test inserts a half-set row (unchanged from section 6); that nothing else changed (no grant, RLS, trigger or function). Non-blocking nits, none a reason to hold:

1. The 55000 message says "correct them with a forward row". A stored half-set row cannot be corrected that way: the registry is immutable and the CHECK covers superseded rows, so only a
   deliberate privileged repair would clear it. No environment can hold one (no producer; the promoted CHECK admits the shape only to a direct insert by a migration), so the path is a guard, not a repair route.
   Suggest wording "stop and escalate".
2. The 55000 refusal path is unexercised (no populated witness; the lane says so). Recommended, not required: a witness at the pre-migration schema with a half-set row, in the style of the
   `20261027100020` parity test.
3. The pre-check reads a FORCE-RLS table without setting `app.cms_rpc`, exactly like the promoted neighbour; it relies on the migration role bypassing RLS (superuser locally). If that ever stopped holding the
   count would read zero and the `ADD CONSTRAINT` scan (not subject to RLS) would fail with a bare 23514. Same assumption as the precedent; setting `app.cms_rpc` in the block would remove it.
4. `supabase/migrations-wip/gaps-db4/` has no `README.md` (the WIP README asks for one); it is removed at promotion anyway.

Promotion order matters: **promote before the canonical gate runs `gaps_db4_registry.sql`**, because its probes `:153-156` (`ok 18`, `19`) are red on the promoted-only schema. At promotion: manifest with
SHA-256 `e7251eaae96d1303fb46b34e41fcff0a19095f7d56fecce666d9e24b8d16fd34`, a section in `supabase/migrations/README.md`, remove the WIP directory, re-run `gaps_db4_registry` and `taxonomy_terms_canonical` canonically.

### V.4 The 94 citations (every one judged; `refutation-v2.json`)

| Criterion | proposed | KEEP | DROP | FIX | new / renamed | status |
|---|---|---|---|---|---|---|
| AC-155 | 17 | 9 | 8 | 0 | 3 | partial (the lane now proposes `partial` + the BOUNDARY text, matching my ruling; the split is root's) |
| AC-210 | 15 | 4 | 11 | 0 | 9 | verified, only with the added activation assertion and the two Worker rows (the proposal still lacks them) |
| AC-223 | 5 | 1 | 4 | 0 | 3 | verified |
| AC-225 | 18 | 5 | 13 | 0 | 9 | verified (no longer contingent: the v1 FIX is met) |
| AC-256 | 39 | 23 | 16 | 0 | 4 | verified (the 21 KEEPs other than `:154` / `:156` hold on the promoted schema alone) |
| **Total** | **94** | **42** | **52** | **0** | **28** | |

DROP classes: NOEFFECT 25 (oracle and instrument controls, the unmask controls), ADJACENT 13, SOURCE 12 (the AC-256 catalog / source proxies the lane re-proposed unchanged), CONFOUNDED 1 (AC-256 `:124`, still green on a
one-directional CHECK), PROOFGAP 1 (AC-155 `:85`).

The 28 new or renamed, individually:

* **KEEP (8).** AC-210 two-domain activate (`:237`) and schedule (`:240`); AC-225 applier-reads detector (`:61`, replaces the v1 substring test I dropped: now three literal fragments, mutation-sensitive, honest title); AC-155
  anon / authenticated with schema USAGE (`:75`, `:77`, replace the masked `:72`, `:74`); AC-256 the missing both-members probe (`:158`) and anon / authenticated with schema USAGE (`:208`, `:210`, replace the masked `:185`, `:187`).
* **DROP (20).** Eight write-witness assertions and their controls (AC-210 `:151`, `:157`, `:172`, `:242`, `:186`, `:229`; AC-223 `:165`, `:186`); the 8 new AC-225 detector controls; the three minimal-pair / unmask controls (AC-210 `:227`, AC-155 `:107`, AC-256
  `:219`); AC-223 `:175`.

Why the witness assertions are still not citations. They are now sound and non-blind (that is the lane's real improvement over the v1 snapshot equalities I dropped). But the ledger clauses of AC-210 and AC-223 state the typed refusal, not its effects;
"refuses and keeps the approval" is BE03c step (5) / DEC-237 prose. Their honest home is AC-086 c7 "commits no partial switch" (optional cross-criterion citation, noted in the JSON), and they stay in the file. `:175` ("a repeat with the same
key") now truly reuses the key (the v1 confound is fixed) but can only show determinism, since a raised RPC commits no reservation.

Status changes against section 3: none in the totals. AC-225 and AC-256 lose their contingencies (detector fixed; probe added; WIP promotion is a root step, DEC-238); AC-210 and AC-223 stay verified on the settled DEC-237 order; AC-155 stays partial.

### V.5 Residual findings (non-blocking)

1. Witness instrument: no control for the idempotency witness; no in-file proof that a witness moves inside a rolled-back call (V.2 item 9, one line).
2. AC-210 quantifier: a last-declared-only mutant is not excluded; mirrored `[instrument, role]` vocabulary would exclude it.
3. AC-210 still lacks the activation assertion under its own clause, and the Worker rows for the 422 (carried in `missedTests`; the same four close AC-086 c4).
4. AC-225: the oracle cannot see dead code around the lock loop (static-oracle boundary); opposed merges remain a race module.
5. WIP nits 1 to 4 above.
6. Consistency flag unchanged: AC-251..AC-255 cite the same catalog-text shapes AC-256 drops again.
7. Operational: the witness file's `CREATE TRIGGER` takes SHARE ROW EXCLUSIVE on six tables, among them the hot `audit_events`, `outbox_events` and `idempotency_records`, until its (rolled-back) transaction ends; harmless on the quiet
   canonical host, not on a shared one. The unmask grants (schema USAGE, INSERT, EXECUTE to anon / authenticated) are transactional and never committed (both files end in `rollback`).

### V.6 Requests to root (ordered)

1. Apply `refutation-v2.json` for AC-155 / 210 / 223 / 225 / 256 (and `refutation.json` for the db3 criteria), by clause text; AC-155 split and limitation as in section 8.
2. Promote WIP `20261029110000` first, then run the canonical gate (the registry file is red without it); consider the one-line wording fix of nit 1 before promotion (promoted migrations are never edited).
3. Add to AC-210 c0 the activation assertion and the two Worker rows, and cite AC-086 c4 with them.
4. Optional hardening lane: witness controls (V.2 item 9), the mirrored AC-210 case, the 55000 witness.
5. The earlier open requests stand: AC-079 revoke apispec receipt, AC-023 reading record, AC-143 guardrails and index fix.

### V.7 Evidence index (verification round)

`recite3/refutation-v2.json`; scratch `scratchpad/claude_s12_refute3/v2/` (`lib2.mjs`, `entries/*.mjs`, `mergelock-v2.mjs`, `simulate-v2.mjs`, `orig/` = the lane's pre-fix backup extracted for diffs); reused `identity-check.mjs` (94 / 94 titles are one whole SQL literal in a `.sql`
entrypoint, unique, exactly one `ok` line in the run-4 TAP, evidence line inside the literal) and `dups.mjs` (the four cited files: 0 duplicates, 0 skip, 0 `not ok`). Tests read in full: the four edited db4 files, the rewritten WIP, `20261014070600` / `70200` / `70400` / `190030` / `120400` for the
detector and witness claims.
