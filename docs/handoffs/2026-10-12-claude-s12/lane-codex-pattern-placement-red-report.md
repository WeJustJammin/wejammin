# Lane report — s12_pattern_placement_red (QA-RED)

Worktree: /home/rob/.codex/worktrees/phase2-slice12/WeJammin (branch claude/phase2-slice12)
Model/effort: Phils-Charm/deepseek-v4.1-flash, high. Root: gpt-6.1-sol, ultra.
Stage: QA-RED only. No production, contract, spec or config edit. No staging/commit.

## Exclusive files written

- NEW apps/worker/src/cms-composition/pattern-placement.test.ts (190 lines)
- NEW apps/worker/src/cms-composition/pattern-placement.test-support.ts (164 lines)
- NEW docs/handoffs/2026-10-12-claude-s12/lane-codex-pattern-placement-red-report.md (this file)

Both code files are under the 300-line limit and pass pnpm exec prettier --check.
No shared support file, contract, registry row, OpenAPI document, route, or adapter was modified.

## Locked contract this RED targets

packages/contracts/src/cms-composition/pattern-instance.ts now defines:

- CompositionInstanceResourceSchema requiring position (int 0..2147483647).
- PatternPlacementResourceSchema = strictObject({ items: array(CompositionInstanceResource).min(1).max(512) })
  with checkPlacement: every row pinned to one revisionId/patternId/patternVersion/linkMode, unique path,
  unique id, and consecutive positions (row.position === items[0].position + index).

BE03c CMS-03C-02 (spec line 160/1360): 201 PatternPlacementResource, one row per block root of the pinned
forest after DEC-181 expansion, all-or-nothing, at consecutive positions appended after the slot's greatest
in forest order (DEC-175, DEC-181, DEC-185).

## Current production behavior (RED source)

- apps/worker/src/cms-composition-production-pattern.ts parses the RPC success with
  CompositionInstanceResourceSchema and returns a single CompositionInstanceResource; a placement body
  therefore fails closed to 502 invalidResponse.
- apps/worker/src/cms-composition/pattern-instance-contracts.ts validInstance still asserts equality
  path === body.slotPath and the port type is CmsPatternInstanceResult<CompositionInstanceResource>.
- apps/worker/src/cms-composition/pattern-instance-routes.ts returns JSON.stringify(result.value) with
  status 201 and etag = "result.value.version".

## Test matrix (actual boundaries)

[DEFECT] = fails against the current code for the intended reason. [GUARD] = passes today and pins a
behavior GREEN must not regress. Predicted split is 8 DEFECT / 10 GUARD across 18 tests; the run will
confirm.

Production adapter (createProductionCmsPatternInstanceDependencies.insertPattern, real fetch seam):

- AC-010 [DEFECT]: a 3-row forest RPC response is accepted as { ok: true, value: { items } } and the value
  parses as PatternPlacementResourceSchema. Today the single-row parse rejects the list and answers 502.
- AC-010 [DEFECT]: a legacy single-resource RPC body fails closed 502 and carries no value. Today it is
  accepted as a single row (ok: true), so the assertion fails.
- AC-218 [DEFECT]: 1-row, 2-row and 33-row forests (all within the 256 KiB response ceiling) are accepted.
  Today every items list is rejected, so count 1 fails.
- AC-218 [DEFECT]: a placement appended after the slot existing rows, positions [3, 4], is accepted as
  { ok: true, value: { items } }. checkPlacement only requires row.position === items[0].position + index, so
  a nonzero start is valid (DEC-185 appends after the slot greatest); today the list is rejected.
- AC-218 [GUARD]: the serialized byte budget holds: 33 rows < 262144 < 512 rows, so a 512-row body is a byte
  question, not a list-shape question (gap G4).
- AC-218 [GUARD]: a 512-row placement is answered 502 fail-closed under the current locked ceiling. This
  characterizes current behavior; it is not acceptance of the 512 contract cap.
- AC-218 [GUARD]: a forest mixing revisionId/patternId/patternVersion/linkMode, or duplicating path/id, fails
  closed. Passes today because the list is rejected wholesale; pins the per-row invariant for GREEN.
- AC-218 [GUARD]: non-consecutive or reordered positions fail closed. Passes today for the same reason.
- AC-218 [GUARD]: empty items, an extra total key, and a non-list body fail closed.
- AC-218 [GUARD]: the request is forwarded to the exact private RPC with p_request matching the placement
  body plus server idempotencyKey/ifMatch. Passes today and proves the adapter still reaches the transport.
- AC-218 [GUARD]: a schema-valid forest whose rows do not bind the request fails closed. Six cases: every
  row uniformly on a wrong revisionId, patternId, patternVersion or linkMode; every row on a wrong
  blockRegistryDigest while the request carries one; and row paths /mainx/root{n} for request slotPath /main
  (a prefix lookalike, not a foreign prefix). Each case asserts the schema control passes first, which only
  establishes fixture validity: today the single-row parser rejects every list body, so the 502 does not by
  itself prove request-binding. The guard becomes binding acceptance only once the paired positive list
  tests are GREEN.

HTTP app.request boundary (createCmsPatternInstanceApp, real Worker middleware):

- AC-010 [DEFECT]: a placement result injected through the frozen port is answered 201 with the exact items
  body. Today validInstance rejects the list, so the route answers 502.
- AC-218 [DEFECT]: a placement appended after the slot rows, positions [3, 4], is answered 201 with the exact
  items body. Today the list is rejected, so the route answers 502.
- AC-218 [DEFECT]: a legacy single-resource port value is answered 502 DEPENDENCY_UNAVAILABLE. Today
  validInstance accepts it (path === slotPath, matching pin), so the route answers 201.
- AC-218 [DEFECT]: the port precondition (operationId CMS-03C-02, body, ifMatch, idempotencyKey) is preserved
  on a placement success. Today the 201 branch is unreachable, so the assertion fails.
- AC-218 [GUARD]: malformed/duplicate-path/empty/extra-key forests are answered 502. Passes today.
- AC-218 [GUARD]: the same six non-binding forests are answered 502 at the app.request boundary. Passes
  today because validInstance rejects the list; binding only after the positives GREEN.

Schema control (PatternPlacementResourceSchema directly, no transport):

- AC-010 [GUARD]: the locked cardinality accepts 1 and 512 rows and refuses 0 and 513, keeping the 512 node
  cap proven without routing it through the byte ceiling.

## GREEN (not in this RED; requires root approval)

1. pattern-instance-contracts.ts: change the port type to CmsPatternInstanceResult<PatternPlacementResource>
   and replace validInstance with a placement validator (strict items 1..512, per-row pin, unique path/id,
   consecutive positions, optional blockRegistryDigest equality).
2. cms-composition-production-pattern.ts: parse the RPC success with PatternPlacementResourceSchema.
3. pattern-instance-routes.ts: return the items body at 201 and drop the per-row etag (see gap G1).

## Gaps left unasserted (no source, no inference)

G1. CMS-03C-02 ETag. The route sets etag = "result.value.version"; a placement has no top-level version and
    the BE03c registry row for CMS-03C-02 names no ETag, unlike the read rows. No assertion is made for or
    against an etag on the placement 201.
G2. First position value. checkPlacement requires row.position === items[0].position + index; it does not
    require a zero start. The "one above the slot's greatest" start is computed under the revision/slot lock
    in SQL and is not observable at the adapter or HTTP boundary, so a nonzero start is asserted only as
    valid, never as a specific value.
G3. Criterion mapping. The placement contract is mapped to P2-S12-AC-010 (items list) and P2-S12-AC-218
    (forest, per-row pin, position); the deeper SQL/expansion clauses are out of this lane's boundary.
G4. Response byte budget vs placement size (transport, needs a locked-spec reconciliation). The contract caps
    a placement at 512 rows (DEC-181), but a 512-row placement serializes to roughly 289 KB, above the BE00
    ordinary-response ceiling of 262144 bytes enforced by MAX_DEFAULT_RESPONSE_BYTES
    (cms-editorial-production-types.ts:65) and by the web reader. No locked amendment reconciles the 512 cap
    with that ceiling, so a 512-row success is not asserted at the transport boundary. The RED instead proves
    the 512 cardinality through the schema control, proves the byte budget with an explicit control (33 rows
    fit, 512 rows do not), and characterizes the oversize body as a 502 fail-closed under the current ceiling.
    This lane neither lowers the 512 cap nor raises the production ceiling.

## Executed RED (first authorized wave, 2026-10-13)

Commands (shared quiet lock, pinned PATH Node 22.23.1 / pnpm 11.24.0):

- flock -s /tmp/wejammin-quiet.lock pnpm exec prettier --write on the two owned files: both already
  formatted (unchanged); prettier --check clean.
- flock -s /tmp/wejammin-quiet.lock pnpm exec vitest run apps/worker/src/cms-composition/pattern-placement.test.ts

Result: exit 1. Test Files 1 failed (1); Tests 8 failed | 10 passed (18); Duration 1.71s.
Log: docs/handoffs/2026-10-12-claude-s12/lane-logs/s12-pattern-placement-focused-red.log
  lines 294, 11496 bytes, sha256 d49268856c4203166bf2864b4673c95349c211ffb80db73f857abd25b53d75cf.

Pinned repeat (native exec_command, login:false, shell:bash; absolute toolchain paths; version gate before
the test): node v22.23.1, pnpm 11.24.0 (PATH puts /home/rob/.local/share/wejammin-toolchain/bin first).
Same result: exit 1, Test Files 1 failed (1), Tests 8 failed | 10 passed (18), Duration 1.84s.
Log: docs/handoffs/2026-10-12-claude-s12/lane-logs/s12-pattern-placement-focused-pinned-red.log,
  sha256 ab8cec5bc2e5518345141db7f8a641e15ccbed8e4a33a1365fca157b1e757d25. The earlier log is preserved
  unchanged (sha256 d49268856c4203166bf2864b4673c95349c211ffb80db73f857abd25b53d75cf).

The eight failures are the intended production RED, each a real assertion mismatch (no fixture, import or
type error):

- adapter 201 multi-row forest: got { ok: false, status: 502 } (single-row parser rejects the list).
- adapter legacy single-resource: got { ok: true, value: ... } (accepted as one row).
- adapter nonzero-offset [3,4]: got 502.
- adapter 1/2/33-row positives: got 502 at count 1.
- HTTP 201 exact items body: got 502.
- HTTP nonzero-offset [3,4] 201: got 502.
- HTTP legacy single-resource: got 201 (accepted).
- HTTP port-precondition 201: got 502.

The ten passes are the guards: schema cardinality (1/512 accept, 0/513 refuse), the byte-budget control, the
oversize 502 characterization, the mixed-row and non-consecutive-position refusals, the six-case non-binding
forest refusal (adapter and HTTP), the empty/non-list refusal, the malformed/duplicate-path HTTP refusal, and
the RPC-forwarding control.

## GREEN (2026-10-13, root-authorized bounded Worker GREEN)

Exclusive production files changed (frozen contracts/transport/config/SQL/other routes untouched):

- apps/worker/src/cms-composition/pattern-instance-contracts.ts: port type is
  CmsPatternInstancePlacementResult (ok value PatternPlacementResource plus a forwarded strong ETag); added
  validPlacementResult (ETag is a strong QuotedVersion) and validPlacement (schema list plus per-row request
  binding: revision/pattern/version/linkMode, request digest when present, path a normalized descendant of
  slotPath within 248 UTF-8 bytes); removed the single-row validInstance.
- apps/worker/src/cms-composition-production-pattern.ts: parses the RPC success with
  PatternPlacementResourceSchema, validates the strong ETag from response headers, and returns
  { ok, value, etag }; the default decoded-response budget for this command is the approved 1 MiB
  (CMS_PLACEMENT_MAX_RESPONSE_BYTES, DEC-189) and any higher configured option is clamped down while a tighter
  option is kept. The global default (MAX_DEFAULT_RESPONSE_BYTES) is unchanged.
- apps/worker/src/cms-composition/pattern-instance-routes.ts: returns the placement items list at 201 with the
  forwarded ETag (no synthesized row-version ETag); validates the placement and its ETag before 201.

Neighboring worker tests updated for the list contract: pattern-instance-routes.test.ts,
pattern-instance-contracts.test.ts, pattern-instance-boundary.test.ts, cms-composition-production-pattern.test.ts.
Owned RED files extended: pattern-placement.test.ts (22 tests) and pattern-placement.test-support.ts.

Receipts (pinned login:false Node 22.23.1 / pnpm 11.24.0, each under flock -s /tmp/wejammin-quiet.lock):

- pattern-placement.test.ts: 22 passed (22). Log sha256 05b425e210baa547b0959b8bea07759927369f1beacc7a5a0e316cfb93222266.
- pattern-placement + routes + contracts + boundary + production-pattern + dependency-unavailable: 6 files,
  100 passed (100). Log sha256 06b334579a4d4c89e85ee1622cc231ab8ba89a30575b41b9b72547355c591379.
- production-worker-runtime-cms-composition.test.ts: 4 passed (4). Log sha256 354b9f1d9f510d199d2e599798053819ca1be6f6f81bc65e9c38f8db0bef8681.
- pnpm type-check: one error, in apps/worker/src/content-schema-registry/claimed-schema-migration-preparation-fallback.test.ts
  (an untracked file owned by another lane; TS2379 exactOptionalPropertyTypes). No error in any file this lane
  touched. Log sha256 ea8281fdd7af54315e22b32ed90816276bf025d440724689ba9ecd42158491ee.
- eslint --max-warnings=0 on the nine touched files: clean (exit 0). Log sha256 8697b3f4771314a6327b90fe37f740c10e43c0a05e294fcf4479ebb1274b474a.

Outstanding gates (not proven here):

- DB/producer: no private RPC cms_insert_pattern_instance is deployed; the producer integration that emits
  the committed entry ETag through the private header seam is not implemented. All adapter evidence uses a
  scripted transport.
- Maximum bound: the 1 MiB decoded-response budget is proven at the adapter boundary with declared-length and
  streamed controls, not against an actual PostgREST response, and not end to end.
- Schema binding of the path to a real pinned forest, expansion, and positions computed under the SQL slot
  lock are not observable here.

## GREEN v2 (2026-10-13, root review: path normalization)

Root found isSlotDescendant accepted any nonempty prefix, so /main/../x, /main//root, /main/root/, /main and
/main/ passed the broad row-path schema without being a normalized node chain. Fixed in
pattern-instance-contracts.ts: the relative suffix (the whole path for the root request /) must satisfy
PatternNodePathSchema (no empty, dot or trailing segment); prefix, non-empty and the 248 UTF-8 bound are
retained. No public contract changed.

Behavioral RED added (pattern-placement.test.ts, adapter and route): refused non-normalized paths
/main/../x, /main//root, /main/root/, /main, /main/, /mainx/root; accepted a normalized descendant
/main/hero; accepted a root-slot placement row /hero; refused the bare / for a root request. All are
schema-valid rows, so the refusal is the binding check, not the schema.

Receipts (pinned login:false Node 22.23.1 / pnpm 11.24.0, flock -s quiet):

- pattern-placement.test.ts: 26 passed (26). Log s12-pattern-placement-green-focused.log
  sha256 ac20b02bcd9bfcf541ab221d8580f16680d1fc8b6fc58a9f930725f0dbd1ed43.
- Seven worker suites (placement, routes, contracts, boundary, production-pattern, dependency-unavailable,
  runtime-composition): 108 passed (108). Log s12-pattern-placement-green-suites-v2.log
  sha256 295033649f1aa30f513f1a2561fbb8fbef50d7f5f6ecab763f51841bb4f6afb6.
- pnpm type-check: exit 0 (the fallback lane's TS2379 was fixed). Log s12-pattern-placement-typecheck-v2.log
  sha256 2625b5c72ef42b8ebf15b7eee6f9ab3847d789f895c277c404aea9f97b65b4a0.
- eslint --max-warnings=0 on the nine touched files: clean (exit 0). Log s12-pattern-placement-lint-v2.log
  sha256 e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855.

The earlier GREEN receipts above are preserved as history; the v2 receipts are current.
