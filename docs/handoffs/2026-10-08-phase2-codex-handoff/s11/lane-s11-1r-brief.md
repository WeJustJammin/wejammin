# Lane S11-1R — Slice 11 contract-spine remediation (read ORCH/lanes/COMMON.md first; LANE = slice11 checkout)
Source: Codex read-only review ORCH/codex/s11-review-contracts.md (§"Read-only review findings", 9 findings). Orchestrator verified #1, #2,
#4 against code/spec (confirmed). VERIFY every other finding yourself against the code and the cited spec lines before changing anything;
refute with evidence when wrong (write the refutation in your report). Lane S11-1 (the original author) is finished; you own its files now.
Ownership: packages/contracts/src/cms-editorial/** , packages/contracts/src/{platform-registries,openapi,registry-primitives}.ts,
infra/openapi-definitions.mjs, infra/openapi-document.mjs, docs/openapi/openapi.json (regenerate via `pnpm contracts:generate`, check via
`pnpm contracts:check`), docs/runbooks/platform/cms-publication.md, tests/contracts/phase-02-slice-11-*.ts (+ NEW
tests/contracts/phase-02-slice-11-sql-parity.test.ts). No SQL, Worker or web edits: if a contract change breaks apps/worker or apps/web
compile/tests, list the exact breakages in ORCH/lanes/NOTES.md ("S11-1R -> S11-4/S11-5/ORCHESTRATOR") — do not edit those apps.
Items (RED test observed first for each, then fix, then GREEN):
 1. Composite transport schemas (decision, schedule, publication, assignment; and any other body with expectedVersion) enforce
    cmsEditorialIfMatchEqualsExpectedVersion via superRefine (400 INVALID_REQUEST semantics as documented).
 2. Canonical ordering: every DependencyManifest list and every VersionSet list must be strictly ascending by its canonical identity
    (BE03b:1757-1771: "Every list is sorted ascending by the lowercase UUID string (bytewise), each identity appears once"; localeSources /
    relations by their documented identity), and versionSetOf/projection output sorted (taxonomyVersionIds bytewise).
 3. Settings snapshot: registry version 1 has no keys -> entries must equal exactly CMS_PUBLICATION_SETTINGS_KEYS (empty); the test that
    permits non-empty v1 snapshots is wrong — fix it (decision-cited: BE03b:1813-1815).
 4. DEC-160 (read it in LANE/.memory/wiki/decisions.md): failed reasons validated against the category's registered failed set; unavailable
    reasons against {provider_unavailable} (categories 1-10, 12-17) or {checker_failed} (11); PreflightRefusalEntry mirrors the
    null-iff-passed invariant.
 5. OpenAPI must not be looser than runtime for the listed refinements (localDateTime calendar ranges, timezone dot segments, route leading
    slash/`//`/2048 code points, decision reason 2000 code points, assignment reason 256 code points + NFC): express what JSON Schema can
    (pattern/maxLength with documented code-point semantics, x- extensions where it cannot) and make the OpenAPI test assert exact
    branch/property/required/constraint structure, not substring presence.
 6. Retryable 503 (preflight DEPENDENCY_UNAVAILABLE) responses carry Retry-After (and the RateLimit headers if BE03b:136 requires them) in
    OpenAPI definitions.
 7. Runbook: mutation-only guards (Idempotency-Key, If-Match, CSRF, JSON body) qualified; safe-read envelope for 15/16/17 documented.
 8. tzdb pin test asserts the exact DEC-153 digests (snapshot 862c1656..., tzdata b2688280..., tzcode cc3d27ca...) from the decision record.
 9. Refusal-catalog tests assert exact ordered reason arrays per operation and absence of executor-only tokens.
 10. NEW SQL parity test (no DB; read files): the TS versionSetOf over the shared fixture equals the SQL expectation in
    supabase/tests/phase_02_slice_11_helpers/version-set-parity.sqlinc (read S11-3s report H3 for its format), and the literal tag in
    supabase/migrations/20261005017595_cms_tzdb_version.sql equals CMS_TZDB_VERSION.
Gates at the end: `pnpm exec vitest run packages/contracts tests/contracts`, `pnpm contracts:check`, `pnpm type-check` (report other apps'
breakages honestly), `pnpm lint`, `pnpm format:check`. Report ORCH/s11/lane-s11-1r-report.md with a checkpoint per item (verified/refuted,
files, RED->GREEN). Final chat <=6 lines.
