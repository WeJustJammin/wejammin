# Lane brief — `claude_s12_hardening_2` (Worker + Web 03c hardening, second pass)

Read `docs/handoffs/2026-10-14-claude-s12/lane-worker-hardening-report.md` (Requests to root) and
`review-worker-hardening.md` (finding 1), and `lane-placement-report.md` (R2, R3). Implement test-first:
1. Locale and related Worker: use `mapCmsCompositionRpcFailure` in `cms-composition-production-locale.ts` and
   `cms-composition-production-related-rpc.ts`; 502 `retryable: true` in `locale-routes-support.ts:~116` and
   `related-content-details.ts:~95` (+ oracle `related-content-errors.test.ts:233-247`); header validation
   before capability/quota in the locale and related write routes (use `headersBeforeAuthorization` in their
   order suites); then delete the `STILL_NON_RETRYABLE_502` exemption in
   `phase-02-slice-12-dependency-unavailable.test.ts`.
2. Web relay: `apps/web/src/server/cms-composition-platform-{mutation,pattern,locale,related}.ts` recompute
   `retryable: status !== 502` (e.g. `cms-composition-platform-mutation.ts:182`); relay the Worker's value
   per BE00 172 (502/503/504 `DEPENDENCY_UNAVAILABLE` retryable true); fix their tests' oracles (spec-cited).
3. Placement Worker adapter (R2): `apps/worker/src/cms-composition-production-pattern.ts` /
   `cms-composition/pattern-instance-*.ts` must map every Slice 12 reason token the promoted producer
   (`supabase/migrations/20261014110000`–`110400`, report `lane-placement-report.md`) emits —
   `revision_not_editable` 409, `pattern_version_not_active`/`pattern_incompatible` 422,
   `block_registry_digest_mismatch` 409 (DEC-186), capability 403, etc. — to the typed contract errors
   (`packages/contracts/src/cms-composition/refusals.ts`, `error-catalog.ts`) instead of a scrubbed 500.
4. R3: contract parity test for the `COMPOSITION-POSITION-DDL` markers between
   `supabase/migrations/20261014110000_*` and `supabase/tests/phase_02_slice_12_pattern_placement/populated-position.sql`
   (model: `tests/contracts/phase-02-slice-12-pattern-lineage-witness-parity.test.ts`).
5. Web `apps/web/src/pages/api/v1/cms/compositions/pattern-instances.test.ts` returns 502 at baseline —
   diagnose (debug-by-test) and fix the right layer.
6. Minor: type the three `as unknown as` casts in `write-header-order.test.ts`.
Files: the files named above and their tests. Run focused, joint 345, full Worker and full Web suites;
tsc/astro check/eslint/prettier on touched files. Report `docs/handoffs/2026-10-14-claude-s12/lane-hardening-2-report.md`.
