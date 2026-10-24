# Lane claude_s12_recite_d report (P2-S12-AC-215 .. AC-296)

## Status

GREEN. All 82 criteria of the range have a proposal in `recite/d-proposals.json` (validated). Read-only lane: no ledger, receipt,
tracker, spec, test or product file was edited; no supabase, docker, db, race module, Vitest suite or Playwright was run.
Worktree `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`, HEAD `b16edb54a7a1b698ed8ca15b6085046d4270626e`.

## Scope

Brief `docs/handoffs/2026-10-22-claude-s12/briefs/recite-proposals.md`, lane `d`. Ledgers `phase-02-slice-12-evidence-ledger-214-285.ts`
(AC-215..AC-285) and `-286-296.ts`. Identities for Vitest were copied from the 2026-10-24 01:04Z full run
(`.lane-logs/canonical/final-evidence-20261023T224619Z/s09/vitest-all.json`) with the eight changed files taken from
`scratchpad/claude_root/uniq8.json`; pgTAP descriptions from the `.sql`/`.sqlinc` source; Playwright and race titles from source.

IMPORTANT: the intake hints (`.lane-logs/s12-claude-intake-20261022/classify-200-296.*`) were stale. Since they were written the
tree gained the DEC-193 migrations, the composition and locale pages, the observability and alert policy, the registry-parity suite,
and the CMS-03B-10 default-template derivation (`20261022010100`) with its gate tests. Every criterion was re-researched against
the current tree; no hint was copied without reading the assertion.

## Output format notes (superset of the brief's schema)

`recite/d-proposals.json` is an array of 82 entries `{criterion, clauses[], proposedStatus, proposedLimitation}`. Each clause has
`index`, `text` (verbatim from the ledger), `existing` (the current citations, informational), `add`, `staleExisting`, `gap`, and
two optional members I added:

* `note`: free text; where it says WEAKEST the citation is one of my doubtful ones (see below).
* `proposedSplit`: 20 ledger clauses are one long sentence that is only partly proven. For those I propose verbatim sub-clauses
  (checked: in order, non-overlapping, only whitespace/`and`/`or`/punctuation between them), each with its own `add` or `gap`;
  `proposedStatus` is computed over the parts. If root prefers not to split, leave the whole clause uncited and use the
  `proposedLimitation` text. Splitting is what lets `partial` be expressed at all for those criteria.

Citation conventions used (follow the precedent of the existing ledgers):

* vitest: file + describe chain and title joined by a space (no ` > `); `*.apispec.ts` titles are static (`identitySource: "static"`).
* pgTAP literal description: `file` is the `.sqlinc` that holds the whole literal (`identitySource: "static"`). A description built
  from a helper (`label || ': …'`, `format`) or from two concatenated literals is marked `"computed": true` and its `file` is the
  top-level `.sql` entrypoint (the receipt owner rule: no whole literal anywhere means the entrypoint).
* race: title is the text after `ok - ` (as in the Slice 11 ledger); `${tag}` template literals are marked computed.
* Playwright: `Describe > title` with `project` `chrome` (`playwright.config.ts`) or `real-route-chrome` (`playwright.s09-real.config.ts`);
  the two `[P2-S12-AC-265]` reserved-key tests have `${reserved}` in their title and are marked computed (`context`, `versions`).

## Files (path, lines, SHA-256)

| Path | Lines | SHA-256 |
| --- | ---: | --- |
| docs/handoffs/2026-10-22-claude-s12/recite/d-proposals.json | 8650 | see final message (hash recorded there; the file is final) |
| docs/handoffs/2026-10-22-claude-s12/lane-recite-d-report.md | this file | see final message |

Scratch (not claimed): `/tmp/claude-1000/-home-rob-Projects-WeJammin/2663dcb2-f742-450b-97cd-0e849cede6cc/scratchpad/claude_s12_recite_d/`
(`build.mjs` assembles and validates the proposals from per-batch `props/*.mjs`; `chkcomputed.mjs` re-checks computed pgTAP texts).

## Runs

None of the forbidden kind. Validation was static: (1) every Vitest citation was found in the merged identity map with status
`passed` and `occurrences` 1; (2) every pgTAP literal citation occurs in its file; (3) 145 computed pgTAP descriptions were
cross-checked against the helper text in the entrypoint closure (116 matched on suffix and label; the 29 flagged by the crude
check are composed with `||` of a variable such as the refusal token or `path` and were checked by hand); (4) status, limitation
length (>= 20) and split tiling were checked against the guard rules; (5) no citation is the sole proof of clauses in more than
one criterion of this range. Not checked: the same rule against the other three lanes' ranges, and whether a cited pgTAP/race
test actually passes (no receipts exist yet).

## Counts

* Criteria by proposed status: **verified 47, partial 25, unverified 10** (current ledger: 0 verified, 13 partial, 69 unverified).
  unverified: 239, 242, 244, 246, 251, 254, 273, 276, 277, 279.
  partial: 216, 218, 219, 221, 223, 224, 225, 228, 233, 238, 248, 252, 253, 255, 256, 261, 265, 271, 272, 278, 287, 289, 292, 294, 295.
* Ledger clauses: 144; 20 of them proposed for splitting (189 units). Units newly cited: 131. Citations added: 675
  (431 pgTAP, 237 Vitest, 3 race, 3 Playwright, plus the existing ones kept).
  AC-275 alone adds 66 (sample of the data-driven registry-parity suite, see weakest).
* Stale existing citations: **0** (every existing citation in the range still names an existing test with that identity).
* Gaps (43 units): missing implementation plus test 6 (AC-221 assignment half, 239, 242, 244, 246, 248 aggregate narrowing);
  pgTAP 26; race 4 (AC-218 placement lock, AC-225 merge lock, AC-277, AC-294); Playwright 3 (AC-265 Back, AC-273); Vitest 3
  (AC-271 state table, AC-272 privacy sweep, AC-278 public projection); bench 1 (AC-279).

## Five weakest citations still proposed (reviewers start here)

1. AC-275: the 25-operation registry-parity suite is data-driven; I cite the aggregate inventory tests plus ONE write
   (CMS-03C-02) and ONE read (cmsLocaleVariantRead) instance per aspect, not all ~440 instances. Either accept or expand mechanically
   (filter vitest-all.json for `phase-02-slice-12-registry-parity*.test.ts`).
2. AC-249: the immediate `cms.pattern.activated.v1` emission is asserted only inside the DEC-199 publication race
   (`change-first: explicit commit order, full effects and unchanged same-key replay`, computed from `${tag}`); no pgTAP covers
   a pattern activation event, aggregate_type/aggregate_version are not asserted there, and a scheduled pattern execution is not asserted.
3. AC-265 / AC-266: page rules (303, 403, 404) rest on source-text assertions of the `.astro` files, fixed-sentence copy tests and
   Worker read-route tests; AC-266 cites the new-pattern 403 notice for the saved-pattern 403.
4. AC-258: the `position` backfill is shown only by the standalone `populated-position.sql` witness (and DDL parity tests); confirm the
   evidence runner executes a standalone populated witness.
5. AC-264 / AC-247: AC-264's alerts are a provider-free evaluator (DEC-219/220), no hosted firing; AC-247's render-plan evidence is
   helper-composed (`cs-detached: …`, `cs-legacy: …`, `cs-retired: …`) and the draft state / field-to-slot negative are not asserted.

Also doubtful but cited (see `note` fields): AC-226 "durable cursor" (realised as a remaining-work predicate), AC-230 locale input
(only en-US sources), AC-241 taxonomy vacuity, AC-262 reviewer's own assignment, AC-286 route-manifest consumer, AC-290 and AC-289
gate-level only (the states cannot be produced through a public producer).

## Test corrections

None (read-only lane).

## Spec citations

BE03c `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md` lines 413, 1304-1306, 1336-1357, 1365, 1377, 1383, 1407-1410,
1457, 1487, 1519, 1533, 1543-1583, 1680, 1787; BE03b lines 308, 1807, 2056; DEC-135, 141, 165, 166, 175-211 as cited in `note` and `gap` text.

## Open items / BOUNDARY

* Unbuilt features that block citations (not stubs of mine): `cms.taxonomy.assignment_integrity` (AC-239), `cms_resolve_taxonomy_version`
  (AC-242), restore of term assignments (AC-244), taxonomy value encoder `term_unavailable` (AC-246 and the assignment half of AC-221/224),
  Slice 12 narrowing of the relay tuple list for template/pattern/taxonomy events (AC-248).
* One new pgTAP file would close AC-251/252/253/254/255/256 together: a governed-table catalog and direct-write suite
  (`supabase/tests/phase_02_slice_12_governed_persistence.sql`); each gap text lists the exact constraints to assert.
* The ledger `limitation` texts of the range are stale (many say "not built"); the proposals carry replacement limitations.

## Requests to root

1. Decide whether to accept `proposedSplit` for the 20 clauses (19 criteria; needed for the partial statuses of AC-216, AC-218, AC-219, AC-221, AC-223, AC-224, AC-238, AC-248, AC-252, AC-253, AC-255, AC-256, AC-258 (verified either way), AC-261, AC-265, AC-271, AC-272, AC-278, AC-292).
2. Confirm how the runner treats standalone pgTAP files (`populated-*.sql`) and `*.apispec.ts` cited as vitest (I cite apispec by
   static title; their identity is not in vitest-all.json).
3. Race identities: the ledger precedent omits the `ok - ` prefix; the brief says to include it. I followed the precedent.
