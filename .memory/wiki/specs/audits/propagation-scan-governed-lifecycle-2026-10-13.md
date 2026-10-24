# Governed lifecycle and retirement propagation scan — 2026-10-13

## Status and authority boundary

- Stage: `/propagate-decision-scan`; **scan complete, apply not authorized by this report**.
- Agent/model: native `gpt-6-astra` / `ultra`.
- Source snapshot: 2026-10-13T21:13:20Z, working tree `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`.
- Exclusive write scope: this report only. No specification, contract, AC, progress, runtime, database, migration, role or setting change performed.
- Direct selected types: (L) owner-approved DEC-188 immutable governed definition version/private lifecycle counter; (R) existing governed-retirement branch versus generic activation wording.
- DEC-188 already authorizes the AC195/AC205 counter correction. Retirement wording below is a **proposal awaiting user confirmation**, not a newly approved product decision.
- The scan/apply skills require a confirmation boundary. No apply shard, full `memory_compile`, or graph refresh was run. The manual decision ledger must not be regenerated; any approved cascade needs a separately bounded graph refresh.
- This is static consistency evidence, not runtime proof, a migration acceptance receipt, an AC check-off, or phase completion.

## Locked source hierarchy

1. [DEC-188:5244–5248](/home/rob/.codex/worktrees/phase2-slice12/WeJammin/.memory/wiki/decisions.md:5244): immutable definition `version`, unchanged pins/edit operands/frozen `subjectVersion`; private positive-bigint `lifecycle_version`, initially 1, +1 per governed transition; activation/execution/retirement event aggregateVersion uses that counter; review CAS remains separate; no public version-model redesign.
2. [BE03c:208,215,1318,1326,1561](/home/rob/.codex/worktrees/phase2-slice12/WeJammin/.memory/wiki/specs/be/03c-composition-taxonomy-localization.md:208): lifecycle metadata exception, review-version If-Match, successor-only definitions, state transitions and event identity. [IA03:272](/home/rob/.codex/worktrees/phase2-slice12/WeJammin/.memory/wiki/specs/ia/03-cms-content-modeling.md:272) and [FE03:1050](/home/rob/.codex/worktrees/phase2-slice12/WeJammin/.memory/wiki/specs/fe/03-cms-content-modeling.md:1050) already preserve public semantics.
3. [BE03c:392](/home/rob/.codex/worktrees/phase2-slice12/WeJammin/.memory/wiki/specs/be/03c-composition-taxonomy-localization.md:392): `activate` requires approved/current evidence, `schedule` adds time resolution, `retire` requires an active subject. BE03c:1326/1492 explicitly say retirement removes exposure and needs no review.
4. [GovernedActivation contract:44–81](/home/rob/.codex/worktrees/phase2-slice12/WeJammin/packages/contracts/src/cms-composition/governed-activation.ts:44): retirement needs **no review decision**, but every action retains reviewId addressing, review `expectedVersion`, strong If-Match and idempotency. Resource fields at110–123 also require reviewId/reviewVersion.
5. [FE03:877,882,1118](/home/rob/.codex/worktrees/phase2-slice12/WeJammin/.memory/wiki/specs/fe/03-cms-content-modeling.md:877): active subjects offer Retire with confirmation, current owner capability, review-version CAS and unconditional MFA. [DEC-113:1659](/home/rob/.codex/worktrees/phase2-slice12/WeJammin/.memory/wiki/decisions.md:1659) requires independent review for activation; it does not require a fresh approval for removing exposure.

## Programmatic inventory and classification

Read scope: the nine documents below in full, plus all 65 `.ts` files selected by `rg --files packages/contracts` whose paths contain `cms-composition`. Total 74 files; 39 contain matching references.

Reference unit: one matching physical line per selected type. Repeated plan/tracker/matrix copies count separately; a line may match both L and R. These are **lexical reference counts, not independent requirement counts**. Broad matching intentionally retains neutral imports, test fixtures, unrelated lifecycle mentions and historical citations; C means no contradiction to the selected decisions in that context, not acceptance of the surrounding feature. Files with zero matches remain in the scanned denominator.

Selection expressions (case-insensitive, applied to each line):

```text
L = DEC-188|lifecycle_version|(?:internal|private).*lifecycle|immutable.*definition|definition.*immutable|subjectVersion|subject.{0,70}version|(?:TemplateVersion|PatternVersion|TaxonomyVersion).{0,70}version
R = retir|CMS-03C-09|GovernedActivation|governed.{0,40}activation|activation.{0,40}governed
```

Classification: E = explicit contradiction; I = implicit assumption/wording ambiguity; C = consistent or unaffected reference. All E/I locations are enumerated below; remaining matched references are C. AC rules apply only to normative plan/tracker/depth rows, not test names referencing those ACs. For example, `governed-activation.test.ts:147` tests retire-reason bounds under AC083 and is C, not the generic approval-gate contradiction.

| Source | L E / I / C | L total | R E / I / C | R total |
| --- | --- | ---: | --- | ---: |
| Phase 2 plan | 2 / 0 / 63 | 65 | 2 / 1 / 57 | 60 |
| Slice 12 tracker | 2 / 0 / 39 | 41 | 2 / 1 / 48 | 51 |
| Slice 12 depth matrix | 2 / 0 / 38 | 40 | 2 / 1 / 41 | 44 |
| BE03c | 2 / 2 / 72 | 76 | 4 / 1 / 74 | 79 |
| IA03 | 0 / 1 / 15 | 16 | 0 / 1 / 18 | 19 |
| IA03 deep dive | 0 / 1 / 9 | 10 | 0 / 0 / 7 | 7 |
| FE03 | 0 / 0 / 39 | 39 | 1 / 1 / 34 | 36 |
| Canonical decision ledger | 0 / 0 / 10 | 10 | 0 / 0 / 7 | 7 |
| Pipeline decision summary | 0 / 0 / 0 | 0 | 0 / 0 / 1 | 1 |
| 65 contract source/test files | 0 / 0 / 52 | 52 | 0 / 0 / 158 | 158 |
| **Total** | **8 / 4 / 337** | **349** | **11 / 6 / 445** | **462** |

Totals: 811 type/reference associations; 19 explicit-contradiction associations and 10 implicit-assumption associations. Counts do not mean 19 distinct product decisions. AC195/205 each have three copies; AC083/207/268 each have three copies.

## L — DEC-188 residue, already authorized correction

### Explicit contradictions

| Finding | Phase plan | Tracker snapshot | Depth matrix | Required correction |
| --- | ---: | ---: | ---: | --- |
| AC195 lists subject `version` among advancing lifecycle fields | 3294 | 1115 | 248 | Replace that lifecycle-field occurrence with `lifecycle_version`; definition fields and definition `version` immutable from creation; guarded metadata-only transition exception. |
| AC205 increments active and superseded subject definition `version` | 3304 | 1125 | 258 | Both subject increments become `lifecycle_version + 1`; retain the distinct review `version` increment. |

Locations: [phase plan](/home/rob/.codex/worktrees/phase2-slice12/WeJammin/.memory/wiki/specs/phases/phase-2.md:3294), [tracker](/home/rob/.codex/worktrees/phase2-slice12/WeJammin/.memory/pipeline/progress/slices/phase-02-slice-12.md:1115), [depth matrix](/home/rob/.codex/worktrees/phase2-slice12/WeJammin/.memory/pipeline/progress/verification/2026-10-11-slice-12-depth-floor.md:248). AC IDs are stable anchors; active dispatch editing can shift tracker line numbers.

- **BE03c:1424** retains legacy wording that immutable template rows enforce `updated_at=created_at` and reject UPDATE, while the same row's Slice 12 delta permits guarded lifecycle metadata updates. Qualify the blanket ban/equality so approved lifecycle transitions remain possible; definition fields/version remain immutable and DELETE stays forbidden. [Source](/home/rob/.codex/worktrees/phase2-slice12/WeJammin/.memory/wiki/specs/be/03c-composition-taxonomy-localization.md:1424).
- **BE03c:1425** similarly says active pattern rows reject UPDATE/DELETE before permitting lifecycle metadata updates. State the same guarded exception explicitly. These are contradictory legacy clauses within otherwise corrected rows, not permission to redesign the guards. [Source](/home/rob/.codex/worktrees/phase2-slice12/WeJammin/.memory/wiki/specs/be/03c-composition-taxonomy-localization.md:1425).

### Implicit assumptions to flag

- **BE03c:208 and1537** emphasize immutability after activation/active state; their fuller context already preserves definitions. Clarify “definition fields/version immutable from creation” to prevent interpreting drafts as in-place editable. This is wording alignment, not an observed runtime defect.
- **IA03:332 and deep-dive03:66** group templates/patterns with block/composition rows and describe immutability “after approval.” Qualify only governed template/pattern definitions and their separate lifecycle metadata; preserve the distinct signed-block and composition-version rules. Do not blanket-rewrite the mixed aggregate row. [IA03](/home/rob/.codex/worktrees/phase2-slice12/WeJammin/.memory/wiki/specs/ia/03-cms-content-modeling.md:332), [deep dive](/home/rob/.codex/worktrees/phase2-slice12/WeJammin/.memory/wiki/specs/ia/deep-dives/03-cms-content-modeling.md:66).

### Consistent anchors to preserve

- AC249/250 in plan/tracker/depth already use lifecycle-based definition event identity and retain term-version identity for term events; no counter replacement there.
- BE03c:215 keeps review CAS separate; :1318 specifies each subject transition; :1427 already limits the taxonomy active-row ban to definition updates; :1561 has correct event identity and no separate supersession event.
- IA03:272 and FE03:1050 preserve public versions and expose no lifecycle counter. Contract resources retain `subjectVersion`, definition version fields and review version fields, with no public `lifecycle_version`.
- DEC-180 G3's historical ledger copies at2603/5142 identify the subject version row as aggregate; DEC-188:5246 explicitly corrects the counter. Preserve historical decisions; do not regenerate the ledger or rewrite history as a new decision.

## R — retirement branch reconciliation, confirmation required

### Proposed interpretation, not applied

Keep the existing review-addressed CMS03C09 transport and CAS. “No review needed” means **no new approval/review decision to retire**, not “no persisted review record.” A legally activated governed definition already has its originating review. No new route, nullable reviewId, alternate subject-version If-Match, synthesized review or public field is proposed.

All three actions retain authentication, unconditional recent binding-bound MFA, disclosure-safe review resolution, current subject-kind owner capability proved under the relevant locks, review-version If-Match/expectedVersion, operation-bound idempotency and transactional audit.

- **Activate/schedule:** require approved/current review evidence; hash, policy, dependency and kind-specific preflight checks remain; schedule additionally uses the Time authority.
- **Retire:** require the resolved subject to be active, else `subject_not_retirable`; do not require fresh approval or dependency/policy/provider/preflight validity merely to remove exposure. Preserve existing lock ordering; this proposal does not remove locks by implication. Commit retired state, lifecycle +1, retirement timestamp, audit and exactly one subject-kind event. Keep definition version/pins unchanged.
- Retirement without any persisted review record is outside the locked request/response addressing model. Supporting that case would require a **new product/addressing/CAS decision** and cascade; it is not part of this proposal or DEC-188.
- Do not infer a new review-counter algorithm from DEC-188. Existing review CAS remains separate; any implementation detail not fixed by the review protocol requires its own explicit source-backed resolution.

### Explicit contradictions

| Finding | Phase plan | Tracker snapshot | Depth matrix | Proposed clarification |
| --- | ---: | ---: | ---: | --- |
| AC083 unconditionally applies approved/current-evidence gate before any action | 3182 | 1003 | 110 | Common MFA/scope/capability/review-CAS checks remain; approved/dependency/preflight checks apply to activate/schedule; active-only retirement branch is explicit. |
| AC268 permits activation form only on approved/blocked subjects | 3367 | 1188 | 321 | Keep Activate/Schedule there, and render Retire for active subjects when server-permitted and owner-capable. |

- **BE03c:1326** applies generic approval/revalidation steps before an explicit no-review retirement branch. Split common checks from action-specific prerequisites; preserve committed invalidation for activate/schedule.
- **BE03c:1470** authorization/precondition row requires approved/current/provider-ready evidence for the whole CMS03C09 route. Add the explicit active-subject retirement alternative, retaining current owner capability and MFA.
- **BE03c:1502** repeats the generic approval/dependency/preflight chain for retirement. Split by action; also make its “exactly one event” wording activation/retirement-specific, since the same paragraph includes schedule acceptance and BE03c:1326/1611 require no event for that action.
- **BE03c:171** route event column says “only” immediate activation or execution, omitting retirement despite its 200 retire resource and event clauses :1552–1554. Include committed retirement; schedule acceptance still emits none.
- **FE03:1069** is the direct approved/blocked-only page-form source mirrored by AC268. Align with already explicit active Retire at FE03:877/1118. [FE source](/home/rob/.codex/worktrees/phase2-slice12/WeJammin/.memory/wiki/specs/fe/03-cms-content-modeling.md:1069).

### Implicit assumptions to flag

| Reference | Location(s) | Proposed wording boundary |
| --- | --- | --- |
| AC207 “needs no review” | plan3306; tracker1127; matrix260 | “Needs no new approval/review decision”; retain reviewId and review CAS, active-state guard and common security checks. |
| BE security summary “needs no review” | BE03c1492 | Same distinction; do not remove transport/CAS or MFA. |
| Generalized review machinery also “retires” | IA03267 | Clarify activation is approval-gated while retirement removes exposure through the existing secure CAS branch. |
| Generic stale dependency response over activate/schedule/retire | FE031798 | Scope dependency-invalidated recovery to activate/schedule; retirement remains usable to remove exposure. |

### Consistent anchors to preserve

- BE03c:392,215,216; the strict contract at `governed-activation.ts:44–81`; resource `reviewId`/`reviewVersion` at112–113; 200 retire mapping at87–90; action-to-retired mapping at125–129; retirement event mapping at154–163.
- FE03:877/882/1118 already specify active Retire, optional bounded NFC reason, confirmation and unconditional MFA. AC082/084/085/087 retain route, security, CAS, confirmation and response semantics.
- Existing contract tests for retirement reason bounds, action-specific fields, strong If-Match and event shape remain valid. Shape tests do not prove runtime branch prerequisites.

## Proposed apply scope per file

| File | Proposed change after appropriate confirmation | Preserve |
| --- | --- | --- |
| `.memory/wiki/specs/phases/phase-2.md` | L: AC195/205. R: AC083/207/268. | All IDs, count285, unchecked status, dependencies, other slices. |
| `.memory/pipeline/progress/slices/phase-02-slice-12.md` | Same five AC bodies, synchronized with phase plan. | Current dispatch records, ownership, evidence and unchecked status. |
| `.memory/pipeline/progress/verification/2026-10-11-slice-12-depth-floor.md` | Same five matrix bodies; refresh affected source anchors without changing obligation ownership/counts. | AC249/250, depth floor and unrelated ledger history. |
| `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md` | L: qualify1424/1425 legacy bans; clarify208/1537. R:171/1326/1470/1492/1502 branch wording. | Review-addressed API, schemas, current grants, lock order, counters and event types. |
| `.memory/wiki/specs/ia/03-cms-content-modeling.md` | L: narrow332 clarification. R:267 branch clarification. | DEC188 note272 and unrelated aggregate semantics. |
| `.memory/wiki/specs/ia/deep-dives/03-cms-content-modeling.md` | L: narrow66 clarification only. | Block release and composition immutability rules. |
| `.memory/wiki/specs/fe/03-cms-content-modeling.md` | R:1069 active Retire;1798 action-specific dependency recovery. | Existing877/882/1118 behavior, public fields and review CAS. |
| `.memory/wiki/decisions.md` | No DEC188 rewrite. Record retirement confirmation/cascade provenance only if approved under separately assigned authority. | Historical decisions and manual-ledger integrity. |
| `.memory/pipeline/progress/memory/decisions.md` | No change required by scan. | Existing summary. |
| `packages/contracts/**/cms-composition*.ts` / `src/cms-composition/*.ts` | No schema redesign required. Optional comment/test clarification only in a separately approved implementation scope. | reviewId, review expectedVersion, If-Match, resource shape, private lifecycle exclusion. |

No source apply is released by this report. Before any apply: present retirement clarification for confirmation; preserve separately authorized DEC188 status; claim exact files; re-read current hashes/AC IDs; apply each contradiction/assumption explicitly. Then verify plan/tracker/matrix text parity, all counters/pins, route/schema parity, unchanged 285 criterion count and no acceptance check-off. Run only the scoped consistency checks authorized for that follow-up; this scan does not authorize runtime work. Refresh graph only after the approved cascade, without full manual-ledger regeneration.

## Reproducible source fingerprints

SHA-256 over exact file bytes at the inventory snapshot. These are evidence identifiers, not promises that concurrently edited tracking files remain frozen.

| Source | SHA-256 |
| --- | --- |
| Phase plan | `15bd664950f6be43da64239a5b06717d59b0be36581e2cd261033c3e80e88112` |
| Slice tracker | `54fd6edf06909ca53ecc57c5e2b3bc6e42a7ac8316ec4bf790339c4a1f690680` |
| Depth matrix | `3068de83f0fa1e6fa2381d04291aabeaa74877e15c9d0d211faeb93f125552c8` |
| BE03c | `f202ee7d8840752f25397db3e02f51e5b7d664ef222bc8582fa5824bccdcc9b6` |
| IA03 | `a087fce3289c8a95b9bc5dc5eb15af9d4e03396e5134c92abf8e624f0ee782cb` |
| IA03 deep dive | `a6cbab5bdd5cda7d5a34475427bc7a600e2cf7df82d2fa2a06e8039eeaed0950` |
| FE03 | `0e1a903e83b40e8e848318c7801b9e872401728b42db4e208c1727a5a60d21b1` |
| Canonical decisions | `fa3514719b61f519325a1a44b09cc3bea9810c9332c803f87bef56cab7a1fcb9` |
| Pipeline decision summary | `fc15f55dbcc48a98ee0b7b95e375d1390fffcfc7e17d5a4230ee8e0406b20f73` |
| Contract corpus manifest | `8917f47019e8b73f5b85b4d4d7dc77c8d8d965aa642de8c63d9b96399de2d492` |

Contract corpus manifest algorithm: sort the 65 selected repository-relative paths; for each, concatenate `path + NUL + sha256(fileBytes)`; join records with LF, no trailing LF; SHA-256 the resulting UTF-8 text. Counts were produced from source with Node built-ins through context-mode; no test modules were imported or executed. E/I mapping is the complete location inventory in this report; all remaining L/R matches are C. The final report's own hash is returned separately to avoid self-referential hashing.


<!-- spec-graph: auto-generated -->
## Related Specs

### Phases into
- [[specs/phases/phase-2|Phase 2 — Identity, admin, CMS/settings]]

### References
- [[specs/phases/phase-2|Phase 2 — Identity, admin, CMS/settings]]
