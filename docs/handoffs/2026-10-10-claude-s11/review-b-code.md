# Slice 11 independent review B: adversarial code review (2026-10-11)

Reviewer B (fresh; wrote none of this code). Scope: `git diff 618ec5c1..HEAD -- supabase/migrations apps packages infra`
(140 files, 24 commits, HEAD `7ca0d9cd`), plus the existing test files that this range changed. The review was
read-only and static: no test, pnpm, psql or docker was run (see the brief). Line numbers are at HEAD.

## Findings

### B-01 — major — the localization recheck path cannot invalidate anything (it is inert by construction)
- Where: `supabase/migrations/20261010164100_cms_dependency_recheck.sql:146-163` (resolver), `:249-251` (run);
  `supabase/migrations/20261005017560_cms_dependency_manifest.sql:254-266` (localeSources build), `:640-736`
  (`cms_manifest_identities_current`); `supabase/migrations/20260927450000_cms_locale_source_stale.sql:75-98`
  (stale producer); P2-S11-AC-113; BE03b:1773, 1865.
- Claim examined: the six consumers, `cms.localization.changed.v1` included, enqueue a recheck that "rebuilds each
  manifest and invalidates on inequality or a non-current identity" (AC-113, ledger `status: 'verified'`), and
  "Approval can never survive a changed dependency" (BE03b:1865).
- Evidence: the source-stale producer inserts a new `stale` locale-variant row that copies `source_revision_id` and
  `source_hash` from the previous row (`previous_row.source_revision_id, ... previous_row.source_hash`) and emits
  `cms.localization.changed.v1` with that variant revision. The resolver maps it to the source revision the review
  froze (correct), the run selects the reviews, and `cms_frozen_dependencies_status` rebuilds the manifest. The
  rebuild's `localeSources` reads the latest variant row (`order by variant.version desc limit 1`), i.e. the stale
  row, whose `{locale, revisionId, hash}` is byte-identical to the frozen entry, so `rebuilt is distinct from frozen`
  is false; `cms_manifest_identities_current` checks schema, template, patterns, blocks and settings only (it never
  looks at `localeSources` or variant state), and BE03b:1773's definition of "current" also omits locale sources. The
  status is therefore `current` and nothing is invalidated. The authoring variant of the event (a new variant
  revision) resolves to the NEW source revision, whose reviews also hold. No test runs a `locale_source` recheck
  (`phase_02_slice_11_recheck_run.sql` exercises schema, block, term and pattern only; `recheck_event_resolve.sql`
  proves resolution, not invalidation). The code conforms to the letter of the spec, but one of the six consumers is
  dead weight that reads as coverage.
- Required fix: an owner/spec decision. Either define locale-source currency (for example: the latest variant of the
  reviewed revision is not `stale`, or the frozen source revision is still the latest source revision) in BE03b:1773,
  implement it in `cms_manifest_identities_current`, and add a run test where a source edit invalidates a reviewed
  variant `dependency_changed`; or record a DEC that locale-source staleness does not invalidate approval and annotate
  AC-113/the ledger that the localization consumer can never invalidate.

### B-02 — minor — "propagates without consuming retries" is not true end to end; a stale proof now costs a retry five minutes later
- Where: `supabase/migrations/20261010162200_cms_execute_publication_schedule_conflicts.sql:99-107`;
  `apps/worker/src/cms-publication-schedule-sweep.ts:182-205`;
  `supabase/migrations/20261005017730_cms_claim_due_publication_schedules.sql` (claim step 1); DEC-169.
- Claim examined: DEC-169 "a stale/mis-bound execution proof propagates its conflict without consuming retries".
- Evidence: the execute call no longer spends a retry, but the sweep never re-executes ("The outcome of an execution
  that failed is unknown, so it is never retried here: the lease expires and the database ladder decides"), and the
  claim's step 1 sends every expired `executing` lease through `cms_schedule_record_failure` (attempt_count + 1). The
  migration header itself says "the lease expiry, not this call, spends a retry". Net effect versus the old ladder: the
  same retry is consumed, and the next attempt is at least the 5-minute lease plus backoff later instead of 15 s.
- Required fix: correct the DEC-169/ledger wording, or have the sweep re-run the checker and re-execute once within the
  live lease on `preflight_evidence_stale` (the execute RPC is idempotent per (schedule, version, lease)).

### B-03 — minor — the recheck RPC principal boundary is pinned by string literal only
- Where: `apps/worker/src/cms-editorial-principals.test.ts:109-120`;
  `apps/worker/src/cms-editorial/review-recheck/rpc-names.ts`.
- Claim examined: DEC-156 "principal-bound at the Worker module boundary" for `cms_dependency_recheck_run` and
  `cms_dependency_recheck_resolve_event` (the SEC-1 manifest relies on it for the service-principal entry).
- Evidence: the test asserts that only `rpc-names.ts` contains the literals. Any Worker module can import
  `CMS_REVIEW_RECHECK_RPC` (or `createReviewRecheckRpcPorts`) and call both service-only RPCs; nothing pins the
  importers, unlike the takedown and verifier ports (`importersOf(...)` at lines 75-91). Today the importers are only
  `rpc.ts`, `production.ts` and the type-only `async-runtime-rpc-types.ts`, so nothing is wrong yet.
- Required fix: add `importersOf(workerRoot, 'cms-editorial/review-recheck/rpc-names')` and `.../review-recheck/rpc`
  allowlists to the principal test.

### B-04 — minor — the schedule identity key was widened without a spec amendment; the schema test was edited to match
- Where: `supabase/migrations/20261010150000_cms_schedule_precision_storage.sql:143-146`;
  `supabase/tests/phase_02_slice_11_schedules_schema.sql:88`; BE03b:1981; P2-S11-AC-122.
- Claim examined: AC-122 and BE03b:1981 "`UNIQUE(entry_id, revision_id, action, local_datetime, timezone, audience)`
  prevents a duplicate schedule".
- Evidence: the constraint is now `UNIQUE (entry_id, revision_id, action, local_datetime, local_datetime_submicro_ns,
  timezone, audience)`, and the test's expected definition was changed to the seven-column form. Two schedules whose
  local times differ only below the microsecond are no longer duplicates. The design contract
  (`docs/handoffs/2026-10-08-phase2-codex-handoff/s11/schedule-nanosecond-implementation-contract-2026-10-10.md`)
  explains it, but no DEC or BE03b/AC text records it.
- Required fix: record a DEC and amend BE03b:1981 and AC-122, or keep the locked six-column semantics.

### B-05 — minor — the widened relay allowlist increases exposure to a relay-wide wedge
- Where: `apps/worker/src/async-runtime.ts:177-179`; `supabase/migrations/20261010164000_cms_review_recheck_relay.sql:68-80`;
  `packages/contracts/src/cms-editorial/review-recheck.ts` (`sourceEnvelope`).
- Claim examined: lane-recheck report: the first sweep relays the historical backlog of the three families, "a one-time
  burst, harmless".
- Evidence: the sweep returns `'retry'` on the first claimed row that `parseOutboxClaim` refuses. That row stays first
  in `occurred_at` order, so after lease expiry it blocks every later row of every family, `job.requested` included.
  This mechanism predates the change, but 164000 now admits a never-relayed historical backlog and three families
  with any registry-key aggregate. The DB claim and the Worker schema agree on event type, schema version and
  aggregate type. The Worker additionally requires RFC-variant v1-v8 UUIDs (`QueueUuidSchema`) for `aggregateId`,
  `correlationId` and `causationId`, plus a positive `aggregateVersion`, and the DB claim checks none of these.
  `cms_trigger_correlation()` accepts any hex UUID from `app.correlation_id`. Nothing proves that the backlog parses.
- Required fix: dead-letter an unparseable claimed row (`complete`/dead-letter instead of `retry`), or add a
  pre-deploy check that every undispatched row of the six families matches the envelope grammar.

### B-06 — minor — no API-level proof of state-filtered paging with a sealed cursor
- Where: `supabase/migrations/20261010161100_cms_history_sealed_cursor_wrapper.sql`;
  `supabase/tests/phase_02_slice_11_e2_scan_history_cursor_privacy.sql`; lane-preflight-cursor report "No real-PostgREST
  spec pages the history with a `state` filter and a cursor".
- Claim examined: P2-S11-AC-086 privacy through the caller-facing route.
- Evidence: the pgTAP suite is thorough: fixed length, fresh nonce, tag/nonce/ciphertext flips, expiry, ceiling,
  domain, context replay and retired key. It calls the private wrapper, though. The sealed cursor is standard base64
  (`+`, `/`, `=`) and travels in a query string, and no Worker-to-PostgREST test pages with it. The contracts accept any
  string of at most 512 characters, so a failure is unlikely, but it is unproven.
- Required fix: one real-stack apispec that pages a state-filtered history through the Worker route with the sealed
  cursor and asserts resumption plus a 409 for a tampered cursor.

### B-07 — minor — template-less entries can exceed the checker node bound and become unpublishable
- Where: `apps/worker/src/cms-editorial/a11y-structural/input-schema.ts:26-56`; lane-integration report open item 2.
- Claim examined: `ACCESSIBILITY_NODES_MAX` (12,288) "is DERIVED from the locked maxima ... a bound below what a valid
  revision can carry would fail closed".
- Evidence: the file says "The locked specs set no per-revision cap for an entry WITHOUT a template ... the template
  maximum stands for every revision". A template-less revision with more than 8,192 live instances therefore exceeds
  the derived bound, gets TARGET_UNREADABLE, and accessibility stays unavailable: the revision cannot be published.
  The 1 MiB load cap binds even earlier.
- Required fix: an owner decision on a per-revision instance cap for template-less entries (spec gap), then align the
  bound.

### B-08 — minor — the CMS lease control is plumbing with no production consumer
- Where: `apps/worker/src/production-job-effect-dispatcher.ts:93-99`;
  `packages/application/src/infrastructure/jobs/consumer.ts:113-129`; lane-lease report "Open".
- Claim examined: the lane-lease report, "private CMS lease-control for the production job-effect dispatcher".
- Evidence: no production code supplies `prepareSchemaDryRun` (grep finds it only in the dispatcher), so CMS dry-run
  jobs still answer `DEPENDENCY_UNAVAILABLE`, and no production code calls `checkpoint()`. The forwarding is correct
  and well tested. Also, when the session cannot open after a successful claim (`session === null`, consumer.ts:129),
  the job returns `retry/lease_conflict` while it holds the claimed lease, so a persistent misconfiguration (missing
  heartbeat port or `leaseNow`) loops until manual intervention. Production wiring supplies both today.
- Required fix: state "forwarding only, no consumer" in the ledger/tracker, and leave the CMS preparation wiring as an
  explicit open item.

### B-09 — minor — the S09 evidence over-states the parity proof
- Where: `tests/contracts/phase-02-slice-09-amendment-evidence.ts:2969`.
- Claim examined: "20261010166000/166100/167000 ... each proven byte-identical to the previous body by its parity suite".
- Evidence: 167000's parity is a corpus test (3,383 inputs against the verbatim previous body); it is not a proof, and a
  boolean validator is not "byte-identical". My member-by-member review agrees with the conclusion (below), so this is
  wording only.
- Required fix: say "equivalence-tested on a corpus (167000) / output-parity-tested (166000, 166100)".

## Verified clean (examined deeply, no finding)

- Sealed cursor crypto (161000/161100): encrypt-then-MAC over `0x01||keyId||nonce||ciphertext`. The tag is verified
  with the constant-time `cms_history_cursor_mac_equal` (fixed 32-iteration XOR) BEFORE `decrypt_iv`. The enc and MAC
  subkeys are domain-separated HMAC derivations whose label prefix `cms-sealed-cursor:v1:` cannot collide with the
  signed-path message prefix `<domain>:v1:`. The nonce is fresh, the length is fixed at 273/364, the 24-hour ceiling
  is enforced, and the reader rechecks `queryHash` and expiry. The envelope kind is chosen by the request, not by the
  scan. SECURITY DEFINER, `search_path=''`, all API roles revoked. The postgres ownership matches the existing signed
  helpers, which read only Vault.
- Every new or changed SECURITY DEFINER function in the range sets `search_path = ''` (scripted check). New API
  grants are only `cms_dependency_recheck_resolve_event`, `cms_dependency_recheck_run` and
  `cms_takedown_preview_tokens`, each service_role only, with ACL tests for anon and authenticated.
- Takedown RPC (165200): narrows the private seam to `takedown`, restores `app.cms_rpc`, and is owned by the CMS
  definer. The Worker port has no importers and its literal is pinned. Writing no audit record is a documented design
  choice (Shard 16 owns the cause).
- Recheck run (164100): bounded at 500 by `limit 501`, and the cursor is emitted only when more remain. Status comes
  from plain reads (`cms_build_dependency_manifest` / `cms_manifest_identities_current` take no row locks), and
  invalidation goes through the single `FOR UPDATE` core in ascending id, so no lock-order inversion is possible. The
  race runner 031 parks runs behind a real row-lock holder. `claim_outbox_batch` is identical to 20261002213000 except
  for the tuple list (owner and ACL are kept by CREATE OR REPLACE), and the producers for `cms.pattern.` and
  `cms.taxonomy.` are registered.
- Publication commands: `cms_record_audit_event` and `cms_emit_event_ids` write exactly the columns of
  `cms_record_audit`/`cfg_emit_effects`. Every path that reaches the evidence recorder in the executor writes its audit
  record with `execution_audit` first, so the new FK to `audit_private.audit_events` cannot fire spuriously. The head is
  observed after `app.cms_rpc` is set and before the first lock, and both lineage callers send `expectedHead`. In the
  final state no caller uses the removed 6-argument verdict or recorder (17710/17740 are replaced by 162100/162200).
  The in-place edits touch no function on the brief's MD5-pinned list.
- Assignment re-proof (17620): pass 2 repeats the full proof under the position-1 locks before any reservation.
- Slice 09 performance: 167000's fast accept is, member by member, a subset of the full rules (key set =
  `cms_exact_keys`; same UUID regex as `cms_valid_uuid`; the reserved list is identical to `cms_reserved_key`; kinds
  exclude object/list; constraints are limited to four numeric keys with tighter digit regexes and numeric `jsonb`
  comparisons; validator pair null; no `defaultValue`; editorConfig tighter). It calls only built-ins that cannot
  raise for these shapes, so I found no input that the full rules refuse and the fast path accepts. 166100's jsonpath
  depth/array/object rules are equivalent to `cms_json_bounded(...,12,128,128)`. 166000's splice is used only when the
  slot text occurs exactly twice and otherwise falls back to direct serialization.
- 150000 on populated data: `ADD COLUMN ... DEFAULT 0` causes no rewrite. The unique key is only widened (it cannot
  fail on existing rows). The new offset check is equivalent for zero remainders. The before/after row hash and the
  catalog comparison exclude the planner statistics that the index rebuild changes, and the ACCESS EXCLUSIVE lock
  keeps autovacuum out. 165000/165100 are create-only or fragment-anchored, with exact-once and inverse checks.
- Changed tests, none weakened: the two async-entrypoint `*-test-support.ts` arity amendments keep the
  exact-first-argument comparison and add length 2 plus a `checkpoint` function (stronger). The upload-completion clock
  change replaces a 5 ms wall-clock race with controlled timers synchronized on the in-flight dependency (stronger:
  the third case can no longer pass by waiting for the 1 s bound). The claim-gate mutation rewrite keeps every
  assertion and adds a journaled restore plus whole-catalog fingerprints; `catalogClaimReaders`' word-token join is
  equivalent to the old `\m name \M` match. The FE island-test extractions are faithful. The SQL refusal-suite
  deletions all correspond to DEC-169 semantics (version_set_stale, a committed lapse refusal, a propagated stale proof).
  `production-composition.test.ts` now uses the real claim row and adds a foreign-token refusal.
- The execute-time lapse of a counted approver not invalidating the review was checked against DEC-120 (only the
  creator is rechecked at execution) and is correct.

## Totals

- Blocking: 0. Major: 1 (B-01). Minor: 8 (B-02 to B-09).
- By verdict: spec gap / inert path 1 (B-01); over-claim 3 (B-02, B-08, B-09); unpinned boundary 1 (B-03); unrecorded
  spec deviation 1 (B-04); robustness exposure 1 (B-05); missing composition test 1 (B-06); owner decision needed 1
  (B-07).

Areas examined deeply: 161000/161100, 165200, 164000/164100 and the review-recheck Worker modules, the lease control
(`cms-lease-control.ts`, `consumer.ts`, the dispatcher, `async-runtime.ts`), 17590/17620/17635/17640/17700/17720/17570/
17020, 162000/162100/162200 (anchor sets against the 17740/17710 bodies), 150000-153000, 165000/165100, 17910 and the
node bound, 166000/166100/167000, the changed test and support files listed above, `claim-gate-*`, and
`infra/reset-local-database.mjs`. Criteria touched: AC-018/021/033 (refusal maps), AC-081/083/086/093/096/100/101/
113/114/115/116/118/119/122, P2-S09-AC-217.

Not verifiable statically (no execution allowed): whether the MD5 pins in 151000-167000 match the installed bodies;
pgTAP, race-runner and apispec outcomes; the AC-217 p95 numbers; the 3,383-input fast-accept corpus; PostgREST/Worker
URL handling of the base64 sealed cursor (B-06); whether any historical undispatched outbox row in a shared
environment violates the queue envelope grammar (B-05).
