# Slice 12 taxonomy authoring integration review — 2026-10-20

Status: local source integration; required slice/phase gates remain open. No AC is closed.

## Scope and authority

- Checkout: `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`, branch `claude/phase2-slice12`.
- Planning, research, validation, independent review and integration: `gpt-6.1-sol` / `ultra`.
- Bounded source execution: `Phils-Charm/deepseek-v4.1-flash` / `high`.
- The owner approved the coordinated response-only `AuthoringContextType.typeKey` evolution. The migration plan, strict-parser compatibility boundary and consumer inventory are in `2026-10-20-authoring-context-typekey-evolution.md`. No new capability, client-chosen authority or deployment was approved.

## Implemented source

- Taxonomy descriptor, exact `{ termIds: UUID[] }` local validation, create collection and typed read-only view. Stored order and permitted duplicates are preserved; the bound is 128 entries. Local shape does not prove active-term eligibility.
- Native labelled checkbox control, polite selection count, explicit clear and bounded hierarchy-level reading. Missing/cyclic/foreign ancestry states `Level unavailable`, never an invented depth; this is not complete paginated hierarchy navigation proof.
- Protected no-store selector transport with strict query/page admission, authenticated ETag matching, abort-aware bounded retry only for declared-retryable 502/503/504 and 429 wait metadata.
- Connected reader with scope keys rather than context-object identity, abort/generation fences, page replacement, first-page refresh, failed-cursor retry, disabled retained options while refreshing/degraded, manual rate-limit recovery and StrictMode cleanup recovery. Authorization refusals remove the page. A verified empty page retains the selection count and explicit clear; reads never write values.
- Create and draft hosts supply the server-derived type key and entry locale. Draft initialization rejects an absent or wrong-schema selected type. Only verified 422 `VALIDATION_FAILED` / `term_unavailable` refreshes options; values are retained and no refusal automatically resubmits the unchanged draft. Unknown outcomes retain their existing exact-request/key replay behavior. The create transport exposes this condition through an internal semantic boolean, not a public API change.
- Directory documentation and bounded field-map/response-fixture extractions accompany the new modules. Older focus tests now count exactly one POST rather than confusing the legitimate selector GET with a duplicate create; their focus/busy/concurrent-activation assertions remain.

## Main review and local verification

Main observed RED before releasing fixes for value shape, duplicate normalization, response cursor grammar, missing dispatch/host scope, refusal/autosave behavior, lifecycle/rate-limit handling and empty-page recovery. Intermediate failed and passing receipts, hashes and test-synchronization corrections are recorded in `../sessions/2026-10-20.md`.

- Final combined local regression: **1,572/1,572 passed across 146 files, zero failed/pending**, native exit 0. Receipt: `.lane-logs/s12-taxonomy-broader-regression-20261020-review-green.json`; SHA-256 `2d88abad3bd318db8fc2f2dcab84b638b5dce6f9fb33f3c26db297de205b987c`. This includes the empty-page recovery, create-focus regression and static import-closure guard.
- Fresh native `tsc --build --pretty false tsconfig.json`, scoped ESLint/Prettier and `contracts:check` all exited **0** after final source normalization. The fresh progress verifier exited **0** after the tracking update (`Progress files consistent.`). These are individual local checks, not canonical `pnpm validate`, browser acceptance or the final phase gate.
- Earlier local evidence includes 91/91 contract/Worker/telemetry tests, 159/159 formatted leaf/decoder/type-key tests, 27/27 reader lifecycle/race tests and 17/17 source import-closure tests. These overlap the combined run and must not be summed as unique coverage.

## Required remaining work and limits

1. Native preflight is still held. The exact one-run sudo approval was consumed; the first command exited 1 with no executable-link stdout and its cause was not established. No retry, PID substitution, renewal or pkexec route is approved. Preserve the immutable approval/consumption/result records and the boundaries in `docs/handoffs/2026-10-14-claude-s12/2026-10-20-native-resumption-boundary.md`.
2. `supabase/migrations/20261020203606_cms_authoring_context_type_key.sql` and its new pgTAP suite are **UNRUN**. No database application, SQL/runtime acceptance, hosted result or generated-database-type check is inferred from TypeScript/schema tests. Old strict parsers cannot be mixed with the new required response member during promotion.
3. The real taxonomy write authority is not implemented or proved by this work: the existing SQL boundary still refuses non-empty values with `taxonomy_source_unavailable`. Implement/verify the Slice 12 registration and receiving obligations through the required TDD/native gates before claiming authoring acceptance.
4. Create/draft integration is not conflict-replacement integration. The conflict consumer has no verified type/locale context wired here; never guess one or infer a new protected read/contract without checking its locked sources.
5. Existing over-cap authoring-context contract/Worker tests and the untouched editorial-runtime test are not remediated or waived by the bounded frontend extractions. Built bundle budgets, browser/keyboard/focus/accessibility behavior and complete hierarchy navigation remain unproved by these local tests.
6. Resume canonical `pnpm db:verify` **before** `pnpm validate`, serialized under the established locks and stopping at the first failing gate, only after the native boundary is resolved. Historical receipts and missing old temporary manifests are not current acceptance evidence.
7. Slice 12 stays **0/296**. Slice 11 and Slices 13–17, all required tracking gates and final `/validate-phase` remain unfinished. AC209/AC211/AC265/AC266 remain separate unchecked external gates.

Final weekly usage observation: **5% used**. The requested 98% Claude-handoff trigger is not met.

No service, stack, provider, hosted, secret/environment or signal operation was part of this frontend integration. Preexisting dirty work is preserved. Primary and Slice 11 checkouts remain outside the edit scope. Source lanes removed their own misplaced new files; those mistakes and the retained empty directory chain are documented in the session record, not concealed as an untouched-filesystem claim. No further cleanup is authorized.
