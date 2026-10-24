# Slice 12 conflict taxonomy integration

## Plan and authority boundary

Main orchestration, research, validation and integration: `gpt-6.1-sol`, `ultra`.
Source execution: `Phils-Charm/deepseek-v4.1-flash`, `high`.
Only the existing Slice 12 checkout is writable. Native/DB/browser/full-phase
gates remain held; the consumed sudo inspection approval is not reusable.

FE03 `CmsTaxonomyFieldEditor` requires labels for the entry locale (line 890).
BE03c CMS-03C-17 returns only the requested locale's label, without fallback
(line 1491). A content type's default locale therefore cannot stand in for the
conflict revision's locale. The locked conflict detail omits locale.

The existing BE03b CMS-03B-15 read accepts an exact `revisionId` (lines 288,
1335–1345; contracts `workflow-read.ts:50–79`). Its assigned-author/editor scope
uses the same `cms_authority_origin` predicates as conflict detail:
`20261005017900_cms_get_entry_workflow.sql:57–59` and
`20261005011800_cms_conflict_detail_relation_sides.sql:80–84`.
Reusing that protected read avoids a new wire member, a current-draft assumption,
or an unbounded history scan. This is composition of existing reads, not a new
capability, public endpoint or client-selected authority.

## Implementation decisions

1. Leave non-taxonomy conflicts' read sequence and view unchanged.
2. For a divergent taxonomy field only, request CMS-03B-15 for the server-read
   conflict's `theirs.revisionId`. Derive a GET carrying the page's existing
   session headers and only this server-derived query member. Validate the full
   existing workflow resource and bind entry ID and all four immutable revision
   reference members: revision ID, revision number, schema version ID and hash.
   On refusal, malformed JSON/schema or mismatch, return the existing safe notice.
3. Add optional JSON-only internal init context `{typeKey, locale, theirs}` from
   these verified reads. It is not a protected request/response schema change.
4. Pass only the type key, locale, injected fetch boundary and refresh token to
   the existing connected taxonomy editor. Use the stable field key for the
   selector; retain unique explicit-control DOM IDs. Submit only the existing
   conflict choice value `{termIds}`; no scope/authority operand is added.
5. A verified 422 validation refusal with `term_unavailable` refreshes the
   selector while retaining every choice/value. Other statuses/reasons and
   unknown outcomes do not refresh or automatically resend. An exact replay of
   an uncertain command retains its original bytes/key.
6. A 409 detail refresh must not replace state with a `theirs` reference that
   differs from the context binding. Treat it as an unverified refresh using
   existing failure behavior; retain choices and old operands.

## Verification state

Existing conflict/workflow baseline: native exit 0, nine files, **65/65** tests.
Receipt `.lane-logs/s12-conflict-taxonomy-20261020-baseline.json`, SHA-256
`56127716159243514cb6784c6ac467cd7454b920eed41e0fa1548e9385e57a0d`.

Main ran the loader RED before authorizing implementation: native exit 1,
**17 collected, 3 passed, 14 failed, 0 pending**. The missing workflow call,
missing context and incorrect usable views caused all fourteen failures; none
was a fixture/schema/collection failure. The three no-extra-read/query guards
already passed. Receipt
`.lane-logs/s12-conflict-taxonomy-loader-20261020-red.json`, SHA-256
`0bf7a06406f03bff0386738ac027daf12305f2b3c7caf39ad23a4f626bc8da41`.

Loader candidate GREEN plus both existing loader suites: native exit 0,
three files, **34/34** tests. Receipt
`.lane-logs/s12-conflict-taxonomy-loader-20261020-green.json`, SHA-256
`f98d09efb30023d94366cc2be509e2dccdd84a85a609d8c3943026658828851e`.
Main reviewed full workflow-schema validation, entry/four-member revision
binding, historical revision acceptance, unchanged conflict CAS operands, and
the conditional read. Canonical internal-type consolidation with the host lane,
host RED/GREEN, final regression/quality gates and independent review remain
pending. Current-thread routing metadata was freshly verified as
`gpt-6.1-sol` / `ultra`; both execution agents were explicitly spawned with the
requested Phils-Charm model / `high`.

Main then ran the host/controller RED: native exit 1, two files,
**12 collected, 1 passed, 11 failed, 0 pending**. Three failures expose the
unavailable explicit taxonomy control; four expose the missing refresh token;
four expose adoption of a mismatched revision reference. The matching-reference
refresh guard passed. All four reference mismatches have separate test
identities. Receipt `.lane-logs/s12-conflict-taxonomy-host-20261020-red.json`,
SHA-256 `cdfec08dbf7655102a61552bb186329bf2da2b781af85db7b613d4b98140b407`.
Only after that run did main authorize host implementation. Both lanes' RED
assertions are frozen. Both loader and host fixtures use `fr-FR`, different from
the content type/default fixture locale. The existing conflict request schema
remains unchanged and the UI test asserts its complete operand key set.

This is adjacent typed CMS-06 conflict-editor regression evidence, not direct
AC-135 coverage (that criterion explicitly names CMS-03B-01/10/11, not 02).
No acceptance checkbox, denominator, depth credit or signature is changed by
this plan. Local tests do not clear the held native, SQL, hosted or phase gates.

## Combined integration — 2026-10-21 continuation

Both execution lanes are frozen. The canonical JSON-only context type is in
`cms-editorial-conflict-state.ts`; the server helper imports it type-only and
the redundant page-init extension was removed. Astro passes the verified init
through unchanged. No protected request/response, SQL, authority or public
endpoint changed in this integration lane.

Main's combined focused run exited 0: **94/94 across 12 files**, zero failed or
pending. Receipt `.lane-logs/s12-conflict-taxonomy-20261020-focused-green.json`,
SHA-256 `ece5e1b8f90d5eb7fb52927783e45d9e2e898e0655a5db6fe7f800ec1efacc55`.
Before main's formatter, all five new RED test/helper files remained byte-for-byte
identical to the sources used for actual RED. Prettier then normalized explicit
paths only. Scoped lint found two unused callback parameters in the loader test
helper; the execution agent replaced only that declaration with a typed
`vi.fn` generic and a parameterless callback. No assertion, fixture or call site
changed. The explicit lint rerun exited 0 with zero warnings.

Repository `pnpm type-check` (`tsc --build --pretty false tsconfig.json`) exited
0 before the lint-only callback correction; a fresh post-correction run is in
progress. The web build-info root list includes all three new suites and the
server helper. The earlier empty-root `tsc --noEmit` probe is not credited as
type validation. Broader regression, final formatting/OpenAPI checks, final
scoped review and progress reconciliation remain pending.

The fresh post-correction repository type-check exited **0**. Scoped ESLint
over all eleven source/test paths exited **0**, zero warnings; Prettier check
over those same paths and live-source `contracts:check` both exited **0**.
OpenAPI remains byte-identical at SHA-256
`d13f3f7b2ae25dd0a77e58fd960f93715af1ca46a8c8adddfdfcfb95ebc11bc1`.
Final runtime sizes are loader **163**, server helper **43**, state **235**,
controller **299**, island **183**, path component **129** lines; all remain
within their applicable caps.

Main's independent scoped source review found no remaining defect in the
entry/revision binding, locale provenance, type-only module boundary, unchanged
request operands, refusal classification, choice preservation or uncertain
replay paths. The guard runs before refreshed operands are adopted. The token
bump and invalid-state patch use two synchronous notifications; neither sends
a command, and the real mounted-island test covers the final retained state
and exactly one refusal-driven re-read. Additional conditional-read latency,
real browser behavior, SQL selector admission and hosted authority are not
proven by these local checks and remain required downstream evidence.

## Final local regression and tracking

Fresh broader regression after the lint correction exited **0**:
**1,641/1,641 across 154 files**, zero failed/pending. Receipt
`.lane-logs/s12-conflict-taxonomy-20261021-regression.json`, SHA-256
`c9b0fc0c5a7d091ae9d5681e59871e87fe0ced2baea3aa2fecb4e60d483c3e56`.
Main's multiset comparison against the prior 151-file/1,612-test receipt found
zero missing existing identities and exactly 29 additions. All 29 identities
from the two actual RED runs appear in this final passing receipt. No skip,
pending test or acceptance/depth credit substitutes for an assertion.

Primary checkout still has exactly its two pre-existing untracked editorial
directories; it was not edited. All three consumed permission records remain
byte-identical to the fresh pre-GREEN snapshot. The native boundary and approval
receipt agree that PID 739's process group/session are **729/729**, not 739/739;
the other pinned tuples also agree. These are recorded identities, not a fresh
process inspection or renewed approval. No privileged/native or stack action
was performed.

Main updated the two directory READMEs, Slice 12 dispatch and the new October 21
session record. Fresh progress consistency after these updates exited **0**.
Slice 12 remains
**0/296**, Phase 2 remains incomplete, and `/validate-phase` has not passed its
completed-slices prerequisite. Required native preflight, `db:verify` before
`validate`, SQL, real-browser, hosted/external and remaining slice gates stay
open. The original objective remains active, not complete.

Final weekly usage observation is **8%**, below the 98% Claude-handoff trigger.
