# Independent review: lane `claude_s12_locale` (CMS-03C-04 completion, CMS-03C-20)

Reviewer: independent adversarial reviewer; did not author the lane. Static review only (no DB, no tests
run, no hashing of WIP files per root's instruction). Worktree HEAD `b16edb54a7a1b698ed8ca15b6085046d4270626e`.
Target report `docs/handoffs/2026-10-14-claude-s12/lane-locale-report.md`, SHA-256
`edf63d9398481b77fc083ede5ebaef8e9f79d16a3825c3a1a7d8505c79a9f66b` (verified).

Read in full: the ten WIP migrations, the three new suites and their fragments, the six edited suites
(diffs), the four Worker files (diffs), the frozen contracts (`locale-variant.ts`, `locale-resolution.ts`,
`preflight-providers.ts`, `cms-editorial/preflight.ts`, `cms-editorial/review-recheck.ts`), the installed
sources the amendments anchor into (20261002167000, 20261013100400, 20261003120410, 20261005017570,
20261010164000, 20261005013100, 20260927450000, 20261005010900), BE03c rows 162/189, 366–410, 1257–1304,
1335–1357, 1387–1399, 1431, 1452–1465, 1546–1557, 1609–1633, BE03b 1800–1821, DEC-121/122/138, tracker
rows AC051–058, AC148–152, AC233–237, AC240–241, AC248, AC260–264, AC276–281, and the run-6 TAP/manifest.

## Status
Complete. Verdict at the end.

## Summary of what holds
- The ten migrations are internally consistent, forward-only, each under 300 lines, grants follow the
  SEC-2 definer pattern, every amendment is anchored exactly-once with an inverse-replacement proof and a
  pg_proc attribute check (050200, 050700, 050800, 050900). The anchors match the installed source I
  reconstructed (20261002167000:146-149, 158, 291-300, 306-314; 20261003120410:28; 20261005017570:379;
  20261010164000:76).
- `cms_uuid_v5` is a correct RFC 4122 v5 (version nibble `& 15 | 80`, variant `& 63 | 128`) and is
  known-answer tested against the published `python.org` vector plus an independent test-side
  reimplementation (variant 001:62-76).
- The resolver core (050500) implements DEC-121 exactly for `none`, `localized` and `no_fallback`; the
  contract invariants of `LocaleFieldResolutionSchema` (lines 58-96) hold for every branch of the SQL
  `case` (050500:123-143). The gate (050600) evaluates all `no_fallback` fields in one statement and is
  dispatched by the deployed evaluator before the registry row (050700, tested gate 001:187-199).
- The three new suites are non-vacuous: exact-string oracles, before/after row-count snapshots, a real
  injected-SQLSTATE deadlock test that only passes with 050900, RLS/grant negative tests, a 24-pair
  determinism check, and a no-text regex over resolver output. Static assertion count: 69 + 43 + 28 own
  assertions, plus 4/4/8 shared-fixture assertions = 73/47/36, matching the report.
- Worker edits are minimal, allowlisted exactly (`locale_limit_reached` only), no `any`, no TODO.

## Findings
Format: `file:line — severity — problem — why it matters — fix direction`.

### F1 — `supabase/migrations-wip/locale/20261014050200_cms_author_locale_variant_slice12.sql:71`, `20261014050300_cms_stale_locale_dependents_slice12.sql:109`, `20261014050800_cms_relay_locale_variant_aggregate.sql:29` — major (promotion-gating) — the dotted aggregate type `cms.locale_variant` is emitted into a consumer pipeline that rejects it
- Spec: BE03c 1395 and the D12 validation row (382-388) name the token `cms.locale_variant`; every other
  Slice 12 aggregate type is underscored (`cms_template_version`, `cms_pattern_version`,
  `cms_taxonomy_version`, `cms_term`, BE03c 1557; `cms_content_entry`). BE00 gives `aggregateType` no
  grammar (00-infrastructure.md:503,517); the implemented consumer grammar is `^[a-z][a-z0-9_]{0,63}$`
  (`20261002184000_consumer_sql_boundary.sql:86` CHECK on `consumer_dead_letters.aggregate_type`;
  `packages/contracts/src/cms-editorial/review-recheck.ts:99`).
- Consequence at promotion (traced, not hypothetical): `claim_outbox_batch` now claims the event
  (050800 adds the tuple; 20261010164000:76 shows the allowlist, the regex at :80 applies only to the
  template/pattern/taxonomy events). The recheck consumer validates the envelope with
  `z.literal('cms_content_entry')` for `cms.localization.changed.v1` (review-recheck.ts:67,140-145) →
  every locale event fails admission → `admitConsumerEvent` dead-letters it →
  `platform_api.consumer_dead_letter_event` hits the CHECK, maps `check_violation` to `INVALID_REQUEST`
  (20261002184000:122-133) → "if the dead letter cannot be recorded the message is retried"
  (`apps/worker/src/cms-editorial/review-recheck/source-consumers.ts:64-65`). Net: every CMS-03C-04 write
  and every fan-out stale row becomes a retried-forever queue message and the Slice 11 `locale_source`
  recheck never fires. Keeping the old tuple (050800) does not help: new events carry the new type.
- Fix direction (owner ruling needed, the token is in a locked spec): ratify `cms_locale_variant`
  (underscore). It matches BE03c's own convention for the four other Slice 12 aggregates and the deployed
  consumer grammar, so the consumer side changes only two literals (`review-recheck.ts:67`,
  `review-recheck.test-support.ts:32`). The lane then changes one literal in 050200/050300/050800 and the
  expectations in variant 001:88, 002:117,124-126, 004:11,17, `locale_stale_backfill.sql:110`. If the owner
  keeps the dot: widen the CHECK on `consumer_dead_letters` (a BE00 table, new migration), the
  `AggregateKeySchema`, the localization literal and the test support — four surfaces. Either way, do not
  promote 050200/050300/050800 before the ruling.

### F2 — `packages/contracts/src/cms-editorial/preflight.ts:146` (row `referenceGateRow('locale', '03c')`), `:69-74` (`registryVersion: '1'` literal type) — major (promotion-gating) — the frozen TS registry mirror still registers only `provider_unbuilt_reference` for `locale`
- `cmsPreflightFailedReasons('locale')` (preflight.ts:180-187) derives from that row, and
  `refinePreflightReason` (preflight.ts:201-238) rejects a `failed` entry whose reason is not registered.
  The Worker parses RPC 422 `details.preflight` through `PreflightRefusalEntrySchema`
  (`cms-editorial/refusals.ts:8,218`; consumed by `apps/worker/src/cms-editorial/workflow-errors.ts` and
  `workflow-error-details.ts`). After 050700, a `locale:failed:no_fallback_missing|no_fallback_stale|
  locale_variant_not_approved` entry is a response-contract failure at the Worker, so a revision blocked
  by the gate answers a scrubbed 500 instead of 422 `preflight_failed` (BE03b 1823). The passing path is
  unaffected. `apps/web/src/components/cms-editorial-workflow/cms-workflow-labels.ts:73` has copy only for
  `provider_unbuilt_reference` (AC241's "fixed reason copy" half).
- Fix direction (contracts/Web lane, same promotion as 050700): replace the `locale` row with
  `{category:'locale', registryVersion:'2', ownerSlice:'03c', providerKey:'cms.locale.no_fallback_gate',
  providerVersion:'1', providerKind:'database', referenceKind:null, reasonCodes:CMS_LOCALE_NO_FALLBACK_REASONS}`
  (widen the `registryVersion` literal to `'1' | '2'`), add the three copy strings, and update the SQL
  parity pins `phase_02_slice_11_helpers_preflight.sql:173` and `:477-483` and
  `phase_02_slice_11_criteria_publish_gates.sql:347-353` (today masked by the baseline `lifecycle_version`
  fixture abort, so their new redness is unprovable until the baseline repair lands).

### F3 — `20261014050300_cms_stale_locale_dependents_slice12.sql:85-89` — major — the stored `stale_field_ids` snapshot is wrong, not a superset
- The fan-out runs from the row-level AFTER INSERT trigger on `cms_entry_revisions`
  (20260927450000:123-125), i.e. at the end of the revision-row INSERT, before any value row of the new
  revision exists. `cms_locale_source_field_hash(new_revision, f)` therefore returns `hash(null)` for every
  field (050100:67-75). A recorded field whose source value was present is always listed (its hash is
  never `hash(null)`), and a recorded field whose source value was absent and is now present is never
  listed (`hash(null) = hash(null)`). The lane's own suite exercises exactly this at variant 002:186-198:
  after the second source edit the stored column of the new stale row is `[title]` while the live truth
  (asserted at :194-198) is `[date]`. No assertion pins the stored column there; the only stored-column
  assertion (002:145) uses containment `?`, which cannot see the defect.
- Why it matters: BE03c 1393 ("`staleFieldIds` carries them; unchanged fields keep their approved state")
  and 1431 define the column as the per-field truth, and AC235/AC260 are written against it;
  `cms_locale_stale_total{locale}` "counts stale fields at append" (1395) would be miscounted. Today no
  production reader serves the column (grep: only the 201 path, always `[]` for a draft), and the
  resolver, gate and `cms_locale_stale_fields` are exact and tested — so nothing is wrong at runtime yet,
  but the first read that serves `LocaleVariantResource.staleFieldIds` from the row (the Web form of AC058
  needs one) ships wrong data. The report's Open item 3 discloses the issue but mischaracterizes it as an
  over-approximation; it is wrong in both directions.
- Fix direction (root decision, cross-lane): (a) the revision writers (`cms_create_revision`,
  `cms_resolve_conflict`, `cms_restore_revision`, shared) call the fan-out after their value inserts and
  the trigger is retired; or (b) a `CONSTRAINT TRIGGER ... DEFERRABLE INITIALLY DEFERRED` (fires at
  commit, values present; every pgTAP suite that asserts fan-out mid-transaction must then `set
  constraints all immediate` before asserting); or (c) a spec amendment making the column advisory with
  `cms_locale_stale_fields` canonical. Until decided: no reader may serve the column, and the lane should
  add the equality assertion on the stored column at 002:186-198 (it is a genuine RED today).

### F4 — `20261014050600_cms_locale_no_fallback_gate.sql:65-69` — major (spec contradiction, owner input required) — `locale_variant_not_approved` applied only at `schedule`/`publish`
- BE03c 1391 states the rule without a phase; BE03b 1819 says the submit phase evaluates categories 1–16,
  which includes `locale` (row 14). Read literally, a locale-variant revision is an effective `draft` at
  submit (CMS-03B-05) and would fail its own submission, so `approved` is unreachable: a genuine
  contradiction between 1391 and BE03b's phase table, not an implementation choice. The author's reading
  is the only one that keeps the lifecycle reachable, so the direction is right, but it also skips the
  check at `execute`, where `cms_revision_effective_state` returns `scheduled` (definition: values
  `published|scheduled|approved|rejected|submitted|draft`), which the literal set `(approved, published)`
  would fail. 050400:27-33 maps `scheduled` to `approved` for the derived state, so the two functions
  disagree about `scheduled`. Gate 001:110-111 pins the skip.
- Fix direction: owner amends BE03c 1391 to "in the schedule, publish and execute phases, a locale
  variant whose revision is not in effective state `approved`, `scheduled` or `published` fails
  `locale_variant_not_approved`"; the gate then keeps the check at `execute` with `scheduled` admitted
  (defense in depth against a schedule whose review was invalidated without cancellation), and the test at
  001:110-111 becomes an `approved|scheduled` pass, not a phase skip. The current behavior is acceptable
  as an interim only if the owner ratifies the phase set explicitly.

### F5 — `20261014050200_cms_author_locale_variant_slice12.sql:50-61` — minor (ratify) — ceiling before the supported-locale check contradicts the catalog in one edge
- BE03c 1291: 422 `LOCALE_VALIDATION_FAILED` "when `locale` is not in the active version's
  `supportedLocales`" is unconditional. With 32 distinct variants already present (reachable: every
  supported locale can be a target from another), an unsupported 33rd locale now answers 409
  `locale_limit_reached` instead of 422. The spec itself calls the ceiling unreachable in a valid
  configuration (1395), so one of the two sentences is unobservable whichever order is chosen. The suite
  reaches the ceiling with raw-inserted unsupported locales and a supported `de-DE` (002:4-72), so the
  ordering edge is not exercised. Owner should record the order in BE03c (one sentence); no code change
  needed if the author's order is ratified.

### F6 — `20261014050400_cms_locale_variant_state.sql` — minor (claim over-reach) — the derived state has no production caller
- grep over `supabase/migrations`, `apps/`, `packages/`: `cms_locale_variant_state` is referenced only by
  the WIP migrations and the suites; the 201 resource hard-codes `'state', 'draft'`
  (20261002167000:320). AC234 ("the browser `LocaleVariantState` also shows `review` and `approved`")
  is therefore built and unit-tested (variant 002:158-163,179-181; gate 001:121-154) but not served to
  any reader. Keep AC234 open until a status read (or the AC058 form's data source) consumes it; the same
  applies to AC150's "editorial reads" caller of CMS-03C-20, which does not exist yet.

### F7 — `20261014050500_cms_resolve_locale_field.sql:53-61, 101-115` — minor (BOUNDARY for 04c) — the one-field form resolves against the newest revision of each locale
- `own_revision` (null `p_own_revision_id`) and every chain member use the newest revision of the locale
  regardless of review or publication state. Correct for the gate (explicit revision) and editorial
  reads; Shard 04 delivery must not call `cms_resolve_locale_field` as-is or a draft fallback locale
  would be chosen for a published page. The core already accepts a revision; 04c needs either a
  published-revision parameter or a projection-side wrapper. Record as a BOUNDARY toward 04c, not a
  defect here. Related: the gate uses the revision's frozen `schema_version_id` (050600:53) while the
  one-field form uses the ACTIVE version (050500:171-175); consistent with the `schema` category
  guarding activeness, but worth one sentence in the spec.

### F8 — row 189 vs 1391 — minor (spec-internal inconsistency, note only)
- Row 189 says the gate "evaluates every localizable field of the revision in one statement"; 1391 and
  AC240 say "every `no_fallback` field". The implementation follows 1391 (050600:54-58). Owner should align
  row 189.

### F9 — test-quality nits (minor)
- `phase_02_slice_12_locale_variant/002-limit-and-fanout.sqlinc:145` — containment (`?`) on the stored
  `stale_field_ids` where equality was available; it masks F3. Replace with `= jsonb_build_array(...)`
  and add the same at :186-198.
- `003-contract-and-idempotency.sqlinc:5-10` and `002:60-64` — the before/after snapshots omit
  `idempotency_records`, so "a failure before commit leaves no record" (AC057) is not proven for the
  reservation of a refused command (the resolution suite does include receipts, 002:99-105). Add the
  count.
- `004-relay-source-race-grants.sqlinc:68-72` — lock position 4 is pinned by a regex over the function
  text, not by behavior. Acceptable while race modules are root-run; say so in the report's AC276 row.
- `010-bench.sqlinc:106,138-142` — hard `< 300 ms` assertions inside the functional resolution suite;
  on a loaded host (the project's own memory: gates need a quiet host) this fails a correctness suite
  for a timing reason. Prefer `diag` plus a generous hard bound, or a separate perf suite.
- All three entry files use `no_plan()`; a silently skipped fragment would still pass. Pin
  `plan(73)`, `plan(47)`, `plan(36)`.
- AC233 "`[]` accepted exactly for the default locale" is reachable (source = a locale revision, target =
  the default locale; 20261002167000:125,175) contrary to Open item 4, and untested; the successor-chain
  clause is untested (disclosed). Both remain open.

### F10 — conventions (minor, pre-existing)
- `apps/worker/src/cms-composition-production-locale.test.ts` (600 lines) and
  `apps/worker/src/cms-composition/locale-routes.test.ts` (886 lines) exceed the 400-line test-file limit
  of `.claude/rules/extensibility.md`; the lane added 66/59 lines to already-oversized files. Production
  file `cms-composition-production-locale.ts` is 298 lines (limit 300). No `any`, no TODO in the diffs.

### Security review (no finding above minor)
- AuthN/AuthZ ordering of CMS-03C-04 unchanged (entry lock → tenant/party concealment → capability →
  reservation → CAS, 20261002167000:98-119); the ceiling check (050200) sits after the reservation and
  before any write, so a refusal rolls the reservation back with the exception (writes-nothing proven at
  002:80-87 for rows/events/version, not for the receipt — F9).
- 403/404 concealment unchanged; the new internal RPCs raise `NOT_FOUND`/`DEPENDENCY_UNAVAILABLE` only to
  definer-owned callers (EXECUTE revoked from PUBLIC/anon/authenticated/service_role, proven at variant
  004:53-65 and resolution 002:136-148); no browser route (Worker `[P2-S12-AC-150]`).
- No PII or locale text in events (variant 001:91-97), resolver output (resolution 002:149-156), or the
  `locale_limit_reached` detail (Worker tests strip extra keys). Input bounds: hashes/ids CHECKed at the
  table (050000), locale regex in the resolver (050500:167-170).
- Idempotency/replay: exact replay, body/path/version mismatch (003:12-35); the typed `CONFLICT` rolls
  back the subtransaction including the reservation (050900:30-37), consistent with 1357 "the retry may
  reuse the same Idempotency-Key".
- Grants: `cms_locale_hashes_valid`/`cms_locale_stale_ids_valid` are IMMUTABLE and executable by the
  definer; CHECK constraints run as the inserting role (definer functions or superuser in tests), so no
  grant gap. `grant select on table ... to wejammin_cms_definer` (050100:123-127, 050500:195-202,
  050600:79-83) names only tables already in the pinned SEC-2 set (the run-6 `sec2_all` diff names only
  `cms_governed_activation_schedules`, another lane's).

## Route-registry clause map (BE03c row 162, CMS-03C-04; row 189, CMS-03C-20)
| Clause | Implemented | Tested |
| --- | --- | --- |
| POST path, LocaleVariantRequest → 201 LocaleVariantResource | Worker routes (pre-existing); SQL 20261002167000:315-325 + 20261013100400 | variant TAP #6-7 (001:25-36); pre-existing route tests |
| assigned author/editor; hidden entry/locale 404; visible without edit 403 | 20261002167000:98-106 (unchanged) | 404 concealment 003:36-49; 403 only in pre-existing `locale_author_rpc` |
| BE00 order, CORS, CSRF, strict JSON, source revision read | Worker (unchanged) | pre-existing route tests |
| key + If-Match; CAS source/entry; unique entry/locale/source revision | 20261002167000:110-134, 301-304; table unique | 003:12-35, 91-94; 004:28-43 |
| 60/120 per min, 15,000 ms, no-store, Tier 2, RPC < 300 ms | Worker (unchanged); 128-field bench | pre-existing route tests; 010-bench (timing, F9) |
| ApiError envelope; 409 `locale_limit_reached` detail | `locale-routes-support.ts:18-19,83-87`; `cms-composition-production-locale.ts:93-95` | Worker `[P2-S12-AC-236]` ×2 |
| event `cms.localization.changed.v1` with per-locale identity | 050200 anchor 4; 050300:106-116 | 001:86-97; 002:114-142 — **F1 token** |
| D12 row: 32-variant ceiling, 409 `locale_limit_reached`, unique dedupe key | 050200:50-61 | 002:54-97, 129-142 (**F5 order**) |
| validation matrix 382-388 (BCP 47, 1-128 fields, chain equality, supported locale, no_fallback) | 20261002167000:158-245 (unchanged) | pre-existing suites; AC233 `[]` and successor clauses untested (F9) |
| lock position 4 (`FOR SHARE` on the content-type version) | 050200 anchor 5 | 004:68-72 (textual) |
| typed deadlock / lock failure → 409 catalog code | 050900 | 004:73-98; Worker `[P2-S12-AC-276]` |
| CMS-03C-20 signature, `LocaleFieldResolution`, no browser route | 050500:152-190 | resolution 002:15-21, 136-148; Worker `[P2-S12-AC-150]` |
| provider `cms.locale.no_fallback_gate` v1 replacing the reference gate; route/media/privacy untouched | 050600, 050700:82-89 | gate 001:66-77 |
| read-only, deterministic | STABLE definer (050500) | resolution 002:99-135 |
| "every localizable field in one statement" (row 189) | only `no_fallback` fields (050600:54-58) | gate 001:84-161 — **F8** |

## Ratification items (root's six questions)
1. **UUIDv5 namespace recipe** — `cms_locale_aggregate_id = v5(v5(DNS, 'cms.locale.aggregate.v1'),
   lower(entry)||':'||lower(locale))` (050100:43-53). RFC-conformant and known-answer tested (001:62-71);
   the name is unambiguous (uuid text has no colon). The two free choices (DNS namespace as the root;
   `:` separator with case folding) are arbitrary and only a sentence in BE03c 1395 can fix them for Shard
   04 and any consumer that must recompute the id. Recommend ratify as written and write the recipe into
   1395.
2. **`locale_variant_not_approved` phase** — spec contradiction confirmed (F4): BE03c 1391 has no phase
   and BE03b 1819 evaluates `locale` at submit, so the literal rule makes a locale revision
   unsubmittable. Owner input needed; recommend the schedule/publish/execute set with `approved,
   scheduled, published` admitted, i.e. one step past the author's choice (which skips `execute`).
3. **deadlock/lock failure → `CONFLICT`** — correct. Matches precedent 20261005013100 (wrapper-level
   subtransaction, whole-message token `CONFLICT`) and BE03c 1357, which names both `deadlock_detected`
   and a lock-acquisition failure (`lock_not_available`, SQLSTATE 55P03); the precedent catches only
   40P01, so the lane is closer to the spec than the precedent. The Worker's pre-existing mapper turns
   `CONFLICT` into 409 `LOCALE_VERSION_CONFLICT` (production-locale.ts:69-74 plus the shared editorial
   mapper), and the spec's closed 409 reason list (1304) has no deadlock token, so no `reasonCode` is
   right. Ratify.
4. **The four smaller choices** — (3) explicit JSON null = no value: consistent with the author command's
   `explicit_null` provenance and null `value_hash` (20261002167000:283-285); ratify. (4) derived state
   with `scheduled` → `approved`: a reasonable extension of 1393's list; ratify together with item 2 so
   the gate and the state function agree on `scheduled`. (5) ceiling before the supported-locale check:
   see F5, needs one spec sentence. (7) legacy stale rows stale in every field: conservative and harmless
   on a fresh database; the populated-DB witness the author requests is the right proof.
5. **Frozen contract mirrors** — the dotted `cms.locale_variant` is the outlier inside BE03c itself and
   contradicts the deployed consumer grammar; the spec/SQL side is what should change (F1), not the
   contracts' grammar. `preflight.ts`'s `locale` row is simply stale and must change with 050700 (F2).
   Minimal correct change: owner ratifies `cms_locale_variant`; three SQL literals, two contract literals,
   the TS registry row and the three Slice 11 oracles land in one promotion.
6. **`stale_field_ids` snapshot** — not acceptable against 1393/1431 as persisted truth, and the report's
   "superset" framing is wrong (F3: under-approximation shown by the lane's own fixture flow). Acceptable
   only under option (c) of F3 (spec amendment making the column advisory), which is an owner decision.

## Test corrections (six existing suites)
1-3. `phase_02_slice_12_locale_author_rpc.sql:105-124`, `locale_source_stale.sql:182-198`,
   `locale_stale_backfill.sql:107-130` — correct and necessary after AC237. The replaced helper
   `pg_temp.s10_outbox_count/payload` (`phase_02_slice_10_rpc/000-helpers.sqlinc:201-234`) filtered only
   `event_type` + `aggregate_id`; the replacement filters `event_type` + `payload->>'entryId'` (same
   selectivity, the entry id moved from the aggregate id to the payload). The backfill edit additionally
   pins `aggregate_type = 'cms.locale_variant'` (stronger). Same counts, same shape assertions. Not
   weakening. They will need the F1 literal if the token changes.
4. `phase_02_slice_10_locale_fanout_branch.sql:72`, `phase_02_slice_11_recheck_locale_source.sql:70` —
   `approved` → `draft` is forced by 050000:93-94 (BE03c 1431 "physical state is `draft` or `stale`").
   Verified neither suite reads the re-stated row's state (the only `variant.state` reads, recheck
   :205,215, count fan-out rows with `state = 'stale'`), and the fan-out skips only `stale` rows
   (050300:71-74), so the change is behavior-neutral. Minimal, spec-cited, not weakening.
5. `phase_02_slice_11_preflight_registry_schema.sql:69,75` — `where version = 1` keeps exactly what the
   assertion text claims ("the migration seeds exactly one row per category"); the registry's newer-row
   rule (20261005017060:10,91-96) makes the unfiltered count wrong by design. Not weakening. A stronger
   companion ("exactly one current row per category" over `cms_preflight_registry_current()`) would be
   a good addition but is not required.

## Deadlock assessment (`phase_02_slice_09_sec2_definer_rls.sql:490` in runs 5 and 6)
- The run is sequential: the runner invokes `pg_prove -v -r --ext .sql` with no `-j` and passes no
  `HARNESS_OPTIONS` into the container (`lanes/lane-db-alt-staged.sh:76-82`); the TAP shows files
  strictly one after another. None of the 33 files opens a second backend: the dblink users
  (`phase_02_slice_09_schema.sql`, `phase_02_slice_09_evidence_mfa.sql`,
  `phase_02_slice_12_template_authority.sql`, the ac265 concurrency suites) are not in the run, and
  `pg_temp.sec2_as` is `set local role`, not a connection (`support/sec2-helpers.sqlinc:5-20`).
- The DETAIL (`Process 292 waits for ShareRowExclusiveLock on relation 21671 ... Process 293 waits for
  ShareLock on transaction 2956; blocked by process 292`) means a second real session held at least
  RowExclusive on the relation (a write, or ShareUpdateExclusive) and was itself blocked on a row lock or
  unique-key wait against the test's open transaction. Autovacuum never waits on a transaction-id
  ShareLock (it cancels itself on conflict), so the author's autovacuum hypothesis is mechanically wrong;
  process 293 was a user backend executing DML outside pg_prove on `supabase_db_wejammin_ev` (another
  lane's or root's composed/apispec test, a race module, a dev Worker, or a stack service). The
  server log (`docker logs supabase_db_wejammin_ev` around 07:12-07:14 UTC on 2026-10-14, "Process 293:")
  names its query.
- Could the WIP migrations cause it? No. They add no trigger, cron job or background writer; 050000's
  `ALTER TABLE` and 050700's registry INSERT run during the reset, before pg_prove; the only new lock is a
  RowShare (`FOR SHARE`) on `cms_content_type_versions` inside `cms_author_locale_variant`, which the sec2
  suite never calls (grep: zero references) and which does not conflict with ShareRowExclusive anyway.
  Runs 7/8 (file alone, with and without the WIP set, byte-identical #11 diagnostics) corroborate.
- Residual risk: none from this lane; the canonical `db:verify` on a quiet host remains the proof.

## Claims in the author's report re-verified statically
- File/line counts: all ten migrations ≤ 213 lines; Worker production file 298 lines; test files as
  stated. Hashes not re-verified per root's instruction.
- 156/156: corroborated by the static assertion count plus the shared-fixture assertions (73/47/36);
  TAP numbers in the per-criterion table are consistent with that offset (e.g. "variant #5" = the first
  column-shape assertion after four fixture assertions).
- "no other Worker behaviour changed": confirmed by the diffs (two production files, allowlist of one
  token each).
- "every existing locale ... suite passes in run 6": the TAP lists them green; the remaining reds are the
  baseline numbers the author names.
- "Test corrections still required at promotion": confirmed and extended (F2 lists the exact pins).
- Over-stated: Open item 3 ("superset", F3) and Open item 4 ("`[]` unreachable", F9); AC234 evidence is
  function-level only (F6).

## Requests to root
1. Obtain owner rulings on ratification items 1, 2, 5 (token) and the F3 option before promoting
   050200/050300/050800 (token) and 050700 (contract mirror).
2. Land F2's contract/copy/oracle changes in the same promotion as 050700; land F1's two contract
   literals with the SQL token.
3. Decide F3's writer-ordering option; until then forbid any read that serves `stale_field_ids` from the
   row, and have the lane add the stored-column equality assertion (a true RED today).
4. Pull the `supabase_db_wejammin_ev` server log for the run-5/6 deadlock to identify process 293; it is
   external to pg_prove and to this lane.

VERDICT: PARTIAL
