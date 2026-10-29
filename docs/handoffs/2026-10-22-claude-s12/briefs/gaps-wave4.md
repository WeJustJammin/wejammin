# Lanes `claude_s12_gaps_{db3,db4}` — close the closable gaps the round-2 refutations named

Read `docs/handoffs/2026-10-14-claude-s12/lane-rules.md` fully first; it binds you (ALT pgTAP through the staged runner
only; tar-backup every untracked file before editing it). Start EVERY shell command with
`cd /home/rob/.codex/worktrees/phase2-slice12/WeJammin &&`. Toolchain `PATH=/home/rob/.local/share/wejammin-toolchain/bin:$PATH`.
zsh does not word-split: multi-file commands go in a bash script. `/bin/ls`, never bare `ls`. Report:
`docs/handoffs/2026-10-22-claude-s12/lane-gaps-<db3|db4>-report.md` (checkpoint early; keep `## Status` current; Bash heredoc
if Write refuses). Root is running canonical gates: your ALT runs queue behind them on the CI lock — that is expected, wait.

## Sources

The CURRENT ledger (`tests/contracts/phase-02-slice-12-evidence-ledger-*.ts`) for each clause text and limitation; the
refutation reports `review-refute2-a-report.md` / `review-refute2-b-report.md` and `recite2/{a,b}-refutation.json` (the
`missedGaps` and reasons of your rows); BE03c `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md`, BE03b, BE00.
DEC-235 (`.memory/raw/events/2026-10-29.jsonl`): BE00 binds a key to (actor_id, operation, key_hash); a different actor is
a distinct binding; the same actor under a changed server-resolved acting party, body, path or version is 409.

## Rows

| Lane | Criterion / clause | What closes it |
|---|---|---|
| db3 | AC-056 "answers a changed acting party" | CMS-03C-04 (`cms_author_locale_variant`): the same actor replays a stored key under a different server-resolved acting party → 409 `IDEMPOTENCY_MISMATCH`, nothing written; control: a different ACTOR with the same key is its own binding (not 409). Precedent: `phase_02_slice_12_template_authority.sql:344-373`. |
| db3 | AC-292 "or scope does not gain replay authority." | CMS-03B-10 (`cms_create_entry`): the acting-party member — one actor with memberships in two parties reuses a completed key under the second party and never receives the first party's response (assert what the spec/implementation gives: mismatch or a scoped miss; cite the line). Name the existing actor-member tests (refute2-b DROPped them only because the party member was missing). |
| db3 | AC-072 "a separation-of-duties violation (the submitter" | Reachability first: can a submitter who is not the creator hold an assignment? If yes, prove the decision refusal is 403 `separation_of_duties` (the token, not `capability_missing`); if no, report BOUNDARY with the refusing lines (root then splits it like the creator part). |
| db3 | AC-143 "the subject (`scheduled` with an equal hash)" | Isolate the subject re-read at fire: review approved and at its version, but subject not `scheduled` (or its hash changed) → `approval_invalidated`. If no producer can build that state, BOUNDARY with lines. |
| db3 | AC-023 "/allowlisted" | CMS-03C-01 with a `compatibleTypeIds` member that is an active content-type version of ANOTHER owner (fixture type `..0104`, `gaps_db1_template/000-fixtures.sqlinc:88`, unused) → the spec's refusal; live check `20261013100200:120-130`. |
| db3 | AC-079 "revoke" Tier 2 p95 | NEW apispec `tests/postgrest/phase-02-slice-12-latency-governed-revoke.apispec.ts` timing CMS-03C-08 revoke (3 warm-ups + 24 samples, the `latency-governed.apispec.ts` helpers and world). Write it; root runs it. |
| db4 | AC-210, AC-223 "c0" | Flip the role-provider registry row to `unbuilt` after approval and drive CMS-03C-09 activate and schedule (fire-time analogue `gaps_db1_schedule_fire.sql:151-158`). |
| db4 | AC-225 "c0" | Source oracle on `cms_act_taxonomy_term`: term rows locked `order by term.id for update` (anchored, inverse check). |
| db4 | AC-155 "c0", "c2" | `aclexplode` owner-only catalog check of the CMS-03C-21 functions (every other role: proacl). |
| db4 | AC-256 "c0" | Catalog suite for `cms_canonical_domain_registry` (columns, constraints, RLS, grants as the clause states). |

For every row: read the clause and its limitation; confirm the gap is real (a test may exist — then report the identity and
write nothing); write the test that proves the clause's exact behaviour (token, state, order, ACL), positive and negative,
through the real entry point and caller role, with a context-cleared case for any SECURITY DEFINER entry point (PAT-031).
New pgTAP in NEW files `supabase/tests/phase_02_slice_12_gaps_<area>.sql` (+ `.sqlinc` dirs) that may `\ir` helpers but never
edit an existing suite; titles unique, literal, with `[P2-S12-AC-NNN]`. A contradiction with the spec is a defect: keep the
RED test, fix forward in a NEW WIP dir `supabase/migrations-wip/gaps-<db3|db4>/` (timestamps db3 `20261029100000`–`109999`,
db4 `20261029110000`–`119999`). A silent or self-contradictory spec → BOUNDARY with lines; never invent.

## Proposals (the next refutation reads them)

Write `docs/handoffs/2026-10-22-claude-s12/recite3/<db3|db4>-proposals.json` in the `recite2/*-proposals.json` schema
(`{ criterion, clauses: [{ index, text, add: [{ tool, file, title, project, identitySource, computed, evidence }], gap }],
proposedStatus, proposedLimitation }`), one entry per row, citing only tests whose asserting line you read and ran green.

## Runs and claim

ALT staged runner for your new files (+ suites a WIP touches); never Playwright, races, apispecs or canonical db commands.
Only NEW files named above (+ your WIP dir, + `recite3/<lane>-proposals.json`). Never edit ledgers, receipts, trackers, specs,
promoted migrations or existing tests. The other lane runs beside you — never touch its files.

Final message to root: GREEN / PARTIAL / BLOCKED, report path + SHA-256, per-row table (criterion, clause, outcome, identity),
run counts, files with SHA-256, BOUNDARY items, defects, requests to root.
