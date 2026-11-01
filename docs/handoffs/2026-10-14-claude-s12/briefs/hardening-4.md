# Lane brief — `claude_s12_hardening_4` (03c 403 token + hardening-3 review minors)

## Why
BE03c :1304 ("Slice 12 typed refusals") gives every 03c operation exactly one lowercase 403 token,
`capability_missing`; the frozen contract `packages/contracts/src/cms-composition/refusals.ts:116-202` lists it
for CMS-03C-01 … 17 and the two taxonomy reads, and `refusals.test.ts` rejects `CAPABILITY_REQUIRED`. Hardening-3
fixed CMS-03C-02 only (`lane-hardening-3-report.md` Open item 3; `review-hardening-3.md` findings 1, 2, 5).
The pre-contract upper-case token survives in these non-test sources (grep at 2026-10-15T08:4xZ):
- Worker route-local 403: `cms-composition/locale-routes.ts:154`, `related-content-routes.ts:145`,
  `template-context-routes.ts:83`, `template-detail-routes.ts:96`, `template-version-routes.ts:144`.
- Worker detail filters that still allowlist it: `template-respond.ts:62-63`, `locale-routes-support.ts:72-73`,
  `related-content-details.ts:68-69`, `taxonomy-safe-details.ts:41-42`; and `pattern-instance-details.ts:36-37`
  falls back to that shared filter for an untyped 403 (review-hardening-3 finding 2).
- Web relays: `apps/web/src/server/cms-composition-platform-mutation.ts:161-162`, `-locale.ts:87-88`,
  `-related.ts:88-89`.
Out of scope (different catalog, leave unchanged): `apps/web/src/server/cms-editorial-platform-error-details.ts`
(BE03b), content-schema-registry, provider-evidence, diagnostics.

## Do, test-first
1. For each 03c route above: route-local 403 answers `{ reasonCode: 'capability_missing' }`; each Worker filter
   relays a 403 reason only when it is in that operation's contract list (use the existing per-operation helper
   precedent `pattern-instance-details.ts` / `cms-composition-platform-pattern-details.ts`); an untyped or
   foreign 403 relays `{}`. RED test per route + filter first (include a session port answering 403
   `{reasonCode:'CAPABILITY_REQUIRED'}` that must come out as `{}`).
2. Web relays: same rule; the Web side never emits `CAPABILITY_REQUIRED` for a 03c operation. Check every Web
   consumer of those relays (template designer status/reasons, locale/related UIs if any) still maps 403 to the
   right copy; update their oracles only with a spec citation.
3. review-hardening-3 finding 1: add DETAIL `'["/secret-pointer"]'` and `null` rows to
   `apps/worker/src/cms-composition-production-pattern-reasons.test.ts` expecting exactly
   `[{path:'/patternId',…}]`, never `secret-pointer`.
4. review-hardening-3 finding 5: one composed Worker test (fetch double → production deps →
   `createCmsPatternInstanceApp`) for `revision_not_editable` and `pattern_nodes_exceeded`.
Slice 11 template oracles that pin `CAPABILITY_REQUIRED` contradict BE03c :1304 + the CMS-03C-01 contract list:
correct them minimally and list every diff under `## Test corrections`.

## Files
The Worker and Web sources and tests above, their sibling tests, and `apps/worker/src/cms-composition/README.md`
(one sentence if needed). NOT `apps/web/src/server/README.md` (the Web taxonomies lane holds it; report the stale
"insertion RPC is not yet implemented" sentence at :170-171 under Requests to root), NOT
`step-up-required.inventory.test.ts`, NOT contracts, NOT `cms-taxonomy-*` Web files, NOT SQL.
`taxonomy-safe-details.ts` is under independent re-review right now: change only its 403 lines and report the
before/after SHA-256.

## Gates
Focused Vitest per change; then full `apps/worker` and full `apps/web` Vitest, worker `tsc --noEmit`, `astro check`
for touched Web files, eslint `--max-warnings=0` + prettier on touched files — all under
`flock -s /tmp/wejammin-quiet.lock`. Record counts. Report `docs/handoffs/2026-10-14-claude-s12/lane-hardening-4-report.md`.
