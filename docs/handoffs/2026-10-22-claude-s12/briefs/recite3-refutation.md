# Review `claude_s12_refute3` — refute the gap-wave-4 proposals (lanes gaps-db3, gaps-db4), separate population

You did not write these tests or proposals; your job is to break them. Read `docs/handoffs/2026-10-14-claude-s12/lane-rules.md`
first (it binds you). Start EVERY shell command with `cd /home/rob/.codex/worktrees/phase2-slice12/WeJammin &&`. Toolchain
`PATH=/home/rob/.local/share/wejammin-toolchain/bin:$PATH`. zsh does not word-split: multi-file commands go in a bash script.
`/bin/ls`, never bare `ls`. READ-ONLY except your two outputs. Never run supabase, docker, db, race modules, Vitest suites or
Playwright in any form (root's canonical gates are live).

## Input

`docs/handoffs/2026-10-22-claude-s12/recite3/{db3,db4}-proposals.json`, the lane reports `lane-gaps-db3-report.md` and
`lane-gaps-db4-report.md` (their BOUNDARY items and runs), the new test files they list, and their ALT TAP outputs (named in
the reports). Ledger rules: `scripts/evidence/README.md` ("What the guard rejects"), `scripts/evidence/ledger-guard-lib.mjs`.
Clause texts: the CURRENT ledger `tests/contracts/phase-02-slice-12-evidence-ledger-*.ts`. Specs: BE03c
`.memory/wiki/specs/be/03c-composition-taxonomy-localization.md`, BE03b, BE00.

**Text changed after the lanes wrote**: AC-056's last clauses are now (root DEC-236, `.memory/raw/events/2026-10-29.jsonl`)
`answers a changed body, path or version under the same key with 409,` | `and never replays to a changed acting party (an
entry outside its scope is the concealed 404, answered before the key is reserved).` — judge db3's AC-056 citations against
the SECOND clause. Lane db3 proposed AC-072 "the submitter" as an unreachable BOUNDARY: if you agree, say so (root then
removes that clause's current outcome-only citations, as refute2-a did for the creator part).

## Check, for EVERY proposed citation (not a sample)

1. **Proof.** Read the asserting lines and fixtures. Does the assertion check the clause's exact behaviour (value, token,
   state, order, bound, ACL, caller role) under the clause's conditions? Reject: setup-only, control-only or no-effect
   assertions filed as proof; a test that passes whether or not the rule exists (blind — e.g. effects counted inside a
   rolled-back EXCEPTION block); source-text proxies for behaviour; adjacent rules; a catalog check standing for runtime
   behaviour the clause names.
2. **Seams** (AC-143, and any other): a labelled seam is citable only if (a) it substitutes only the read under test, (b) a
   control shows every other disjunct of the decision is false, so only the clause's condition can drive the outcome, (c) the
   production object is restored byte for byte and that restoration is asserted, (d) the clause's behaviour on that state is
   what the assertion checks. Say KEEP/DROP per citation with these four points.
3. **Readings.** AC-023 "/allowlisted" read as owner scope (BE03c 407): judge the reading against BE03c 380/407 and say
   whether it closes the clause. AC-155 c0 with registered callers not built (db4): is "verified" honest, or is part of the
   clause a BOUNDARY?
4. **Identity** (static): one description per file; a `.sql` entrypoint (not a `.sqlinc` without an including `.sql`);
   computed descriptions under the entrypoint.
5. **Gaps** the lanes missed, and **status** recomputed from what you KEEP.

## Output

`docs/handoffs/2026-10-22-claude-s12/recite3/refutation.json` — an array in the `recite2/*-refutation.json` schema
(`criterion`, `citations[{clauseIndex, title, verdict, reason, fix, dropClass}]`, `splits`, `missedGaps`, `missedTests`,
`status`), one entry per proposed criterion, written as you go. Report `docs/handoffs/2026-10-22-claude-s12/review-refute3-report.md`:
counts, DROP classes, status changes, the most serious findings, the seam and reading rulings, verdict ACCEPT / ACCEPT-WITH-DROPS /
REJECT. Final message to root: verdict, both paths + SHA-256, counts.

## Also: the gaps-db4 WIP migration (you did not write it; review before promotion)

`supabase/migrations-wip/gaps-db4/20261029110000_cms_canonical_domain_registry_provider_pair.sql` adds
`CHECK ((provider_key is null) = (provider_version is null))` to `cms_canonical_domain_registry` (BE03c: key and version are
non-null exactly when the provider is built). Check: the constraint matches BE03c's registry row (cite lines) including the
`provider_state` relationship; it validates on a POPULATED database (every seeded and test-reachable row; is `NOT VALID` +
`VALIDATE` needed?); the migration's anchors, idempotency and comment style match its promoted neighbours; no grant, RLS or
function changes. Verdict PROMOTE / PROMOTE-WITH-CONDITIONS / DO-NOT-PROMOTE in the report.

## Note on AC-210 / AC-223 (owner question pending)

The activation verdict checks "every declared domain has a built provider" BEFORE the frozen status
(`20261014070200_cms_governed_activation_core.sql:5-7, 58-64`), whereas BE03c 1490 orders the dependency recheck (step 4)
before the taxonomy preflight (step 5). Root has put the order to the owner. Judge db4's citations against the CURRENT clause
texts; flag any citation whose proof depends on which order is chosen.

(Root, after launch: the order is settled without the owner as DEC-237 — AC-210/AC-223 require the 422 at activation,
reachable only with the provider check first; BE03c step (5) now says so. Citations relying on the implemented order stand.)
