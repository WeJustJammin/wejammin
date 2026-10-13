# Criteria and spec wording batch: draft for owner ratification

Drafted 2026-10-11 on `claude/phase2-slice11` (HEAD `89f30363`; the Slice 11 tracker, the Phase 2 plan, BE03b, BE00, IA03 and decisions.md are unmodified relative to HEAD; nothing in the repository was changed except this file).
Read-only draft. Nothing here is applied. Approve all items, or strike single ids from the checklist at the end.

How to read an item:

- CURRENT is the tracker (or plan) text copied by script from the file, from the checkbox up to the first source link. For every Slice 11 item the plan line (`.memory/wiki/specs/phases/phase-2.md`) is checked for equality after link normalization.
- PROPOSED is CURRENT with exactly the DELTA fragments replaced, each fragment asserted to occur once. Everything else is untouched.
- Spec edits (Section 2) show the exact current and proposed sentence or cell with its line number in `.memory/wiki/specs/be/03b-editorial-workflow-publication.md` (BE03b). Table padding is not significant and is collapsed.
- Line numbers are those of this tree. Older reviews cite BE03b:1773 and :1917; the same text is now at :1783 and :1927.
- Slice 10 ids always carry the `S10` prefix below. `P2-S10-AC-038` and `P2-S11-AC-038` are different criteria.

> **Orchestrator note (2026-10-11):** BE00:172/590 maps a 502 to the global code `DEPENDENCY_UNAVAILABLE`
> (`{ dependencyClass, retryable: true }`); no spec or DEC defines `BAD_GATEWAY`, yet the CMS Worker routes
> (Slice 10 on `main` and Slice 11) emit `code: 'BAD_GATEWAY'`. The proposed texts below therefore name
> `DEPENDENCY_UNAVAILABLE`, and a conformance fix (Worker codes, web error mapping, tests) is queued as
> implementation work regardless of this ratification. Further alignment edits outside BE03b: IA03:43 (blanket
> author bar vs DEC-164) and BE03b lines near 193, 1858, 2093, 2184 (DEC-161) are included in Section 2.

## Rulings this batch rests on (all already recorded unless marked)

| Ruling | Where | Effect on this batch |
| --- | --- | --- |
| DEC-155 | decisions.md:2242 | AC-035, AC-038, AC-041 defects were routed to this batch |
| DEC-161 | decisions.md:2341 | A counted approver's assignment revoke invalidates the open review `reviewer_authority_changed` |
| DEC-164 | decisions.md:2355 | The author is barred from CMS-03B-07 only for action `publish` (BE03b:195, :269); changes the S11-0 AC-038 proposal |
| DEC-169 | decisions.md:2425 | A non-current frozen set at CMS-03B-07/09 is a committed 409; a lapsed counted approver is a committed `preflight_failed` refusal with invalidation and schedule cancellation |
| DEC-171 | BE03b:2266 and :1991 only | Schedule identity key carries `local_datetime_submicro_ns`. NOT in decisions.md or `.memory/raw/events` (last canonical id there is DEC-169); see N-3 |
| BE00:590, :585, :172 | .memory/wiki/specs/be/00-infrastructure.md | 502 is the invalid-upstream-response status |

## Section 1: Slice 11 criteria (11 items)

### S1-01 P2-S11-AC-035 (DEC-155: broken sentence, E6/E11 lag)

CURRENT (tracker line, copied byte-for-byte up to the source links):

```text
- [ ] **P2-S11-AC-035** — CMS-08 Submit/review/approve: given Revision is in draft state on an entry the submitter may edit and its frozen hash and dependency manifest resolve; each decision requires a reviewer distinct from the author where the workflow says review, and a protected risk class additionally requires two distinct humans, the named specialist capability and recent MFA., implement locked behavior and completion exactly. Operations: CMS-03B-15 (workflow read), CMS-03B-16 (review detail), CMS-03B-17 (reviewer queue) and CMS-03B-18 (reviewer assignment), BE03b ledger 25.02.03.
```

PROPOSED:

```text
- [ ] **P2-S11-AC-035** — CMS-08 Submit/review/approve: given Revision is in draft state on an entry the submitter may edit and its frozen hash and dependency manifest resolve; each decision requires a reviewer distinct from the author and from the submitter where the workflow says review, every decision requires recent binding MFA, and a protected risk class additionally requires two distinct humans and the named specialist capability, implement locked behavior and completion exactly. Operations: CMS-03B-15 (workflow read), CMS-03B-16 (review detail), CMS-03B-17 (reviewer queue) and CMS-03B-18 (reviewer assignment), BE03b ledger 25.02.03.
```

DELTA (exact fragments replaced):

```text
- each decision requires a reviewer distinct from the author where the workflow says review, and a protected risk class additionally requires two distinct humans, the named specialist capability and recent MFA., implement locked behavior
+ each decision requires a reviewer distinct from the author and from the submitter where the workflow says review, every decision requires recent binding MFA, and a protected risk class additionally requires two distinct humans and the named specialist capability, implement locked behavior
```

WHY: The current sentence breaks at ".," and states recent MFA only for protected reviews; DEC-155 (decisions.md:2242-2253) routed exactly this to the owner batch. The stronger rule is locked upstream: IA03:42 (AC-CMS-08), BE03b:195 (E11: a reviewer is never the revision author or the review submitter, one decision per human) and BE03b:2057 (every decision requires recent MFA, E6). The proposal is the S11-0 report section 7 text (lane-s11-0-report.md:108-109); it equals IA03:42 except one added comma. No later DEC conflicts.

EFFECT: No code change; the shipped rule is already the stronger one. The ledger entry (`tests/contracts/phase-02-slice-11-evidence-ledger-035-066.ts`) must be regenerated with the new text byte-for-byte and re-tiled. The two new clauses are provable by existing tests: "and from the submitter" by `supabase/tests/phase_02_slice_11_rpc_review_decision_refusals.sql:147-151` (submitter and author are 403 `separation_of_duties`) and "every decision requires recent binding MFA" by `:84-97` (stale, future, unverified, absent proof is `STEP_UP_REQUIRED`, 590 s accepted) plus `tests/postgrest/phase-02-slice-11-decision-contracts.apispec.ts` (none/stale proof refused before any RPC). The ledger refresh already keeps AC-035 verified because the shipped rules are stronger (ledger-refresh-report.md:117).

### S1-02 P2-S11-AC-038 (DEC-155 adjusted for DEC-164)

CURRENT (tracker line, copied byte-for-byte up to the source links):

```text
- [ ] **P2-S11-AC-038** — CMS-09 Schedule publish/expire: given Actor holds the CMS publisher capability with any required step-up, the target revision is approved with its frozen hash and dependency set intact, and the request supplies a local datetime, IANA timezone, unambiguous resolved UTC instant and tzdb version., implement locked behavior and completion exactly. Operations: CMS-03B-20 (internal schedule claim and execute RPC), BE03b ledger 25.02.04.
```

PROPOSED:

```text
- [ ] **P2-S11-AC-038** — CMS-09 Schedule publish/expire: given Actor holds the CMS publisher capability with recent binding-bound MFA, is not the author of the revision when the action is `publish`, the target revision is approved with its frozen hash and dependency set intact, and the request supplies a local datetime, IANA timezone, unambiguous resolved UTC instant and tzdb version, implement locked behavior and completion exactly. Operations: CMS-03B-20 (internal schedule claim and execute RPC), BE03b ledger 25.02.04.
```

DELTA (exact fragments replaced):

```text
- given Actor holds the CMS publisher capability with any required step-up, the target revision is approved with its frozen hash and dependency set intact, and the request supplies a local datetime, IANA timezone, unambiguous resolved UTC instant and tzdb version., implement locked behavior
+ given Actor holds the CMS publisher capability with recent binding-bound MFA, is not the author of the revision when the action is `publish`, the target revision is approved with its frozen hash and dependency set intact, and the request supplies a local datetime, IANA timezone, unambiguous resolved UTC instant and tzdb version, implement locked behavior
```

WHY: DEC-155 proposed "is not the author of the revision" without qualification (lane-s11-0-report.md:110-111, copying IA03:43). That now conflicts with DEC-164 (decisions.md:2355-2367) and BE03b:269/:195, which bar the author only when the action is `publish` (403 `separation_of_duties`). "any required step-up" lags E6 (BE03b:195, :2057: MFA is unconditional for CMS-03B-07). The fragment "., " is the punctuation defect. IA03:43 itself still states the blanket form (see N-2).

EFFECT: No code change. Tests: author cannot schedule a publish `supabase/tests/phase_02_slice_11_rpc_publication_schedule_refusals.sql:159-161`; author may schedule an expire `supabase/tests/phase_02_slice_11_rpc_publication_schedule.sql:169-172`; unconditional step-up `..._schedule_refusals.sql` (stale, future, unverified, absent proof) and `tests/postgrest/phase-02-slice-11-schedule.apispec.ts` ("a missing, stale or future-dated step-up is 401 before any RPC"). Ledger entry regenerated and re-tiled; stays verified.

### S1-03 P2-S11-AC-041 (truncated mid-word "revocation sta")

CURRENT (tracker line, copied byte-for-byte up to the source links):

```text
- [ ] **P2-S11-AC-041** — CMS-13 Preview/diff/publish: given Preview requires a capability on the target entry and mints a token bound to user, acting context, revision, the full version set, audience/locale/route, expiry and nonce, rechecked on every open; publish additionally requires the CMS publisher capability, an approved revision whose frozen hash and dependency set still match, and a preflight rerun against current revocation sta, implement locked behavior and completion exactly. Operations: CMS-03B-19 (internal preview-token verifier RPC), BE03b ledger 25.03.04.
```

PROPOSED:

```text
- [ ] **P2-S11-AC-041** — CMS-13 Preview/diff/publish: given Preview requires a capability on the target entry and mints a token bound to user, acting context, revision, the full version set, audience/locale/route, expiry and nonce, rechecked on every open; publish additionally requires the CMS publisher capability, an approved revision whose frozen hash and dependency set still match, recent binding-bound MFA, a publisher who is not the revision's author, and a preflight rerun across the registry of preflight categories against current revocation state, implement locked behavior and completion exactly. Operations: CMS-03B-19 (internal preview-token verifier RPC), BE03b ledger 25.03.04.
```

DELTA (exact fragments replaced):

```text
- match, and a preflight rerun against current revocation sta, implement locked behavior
+ match, recent binding-bound MFA, a publisher who is not the revision's author, and a preflight rerun across the registry of preflight categories against current revocation state, implement locked behavior
```

WHY: The text is cut inside a word (DEC-155; ledger-refresh-report.md:93-95). The restored words are IA03:47 (AC-CMS-13) verbatim, which is also lane-s11-0-report.md:112-113. They agree with BE03b:275 and :195 (CMS-03B-09 is the publish-only command; it bars the author unconditionally and step-up is unconditional) and BE03b:1813 (publish phase evaluates all 17 categories, `revocation` rechecks publisher authority). No later DEC conflicts (DEC-164 concerns only CMS-03B-07).

EFFECT: No code change. The AC-041 ledger entry is partial only because the "sta" tail is uncited; after the restored text it re-tiles and becomes verified. Citations: preflight rerun against current revocation `supabase/tests/phase_02_slice_11_rpc_publication_publish_refusals.sql:257-284` (lazy lapse, 17-entry report) and `tests/postgrest/phase-02-slice-11-publish-preflight.apispec.ts`; author refusal `..._publish_refusals.sql:143-145`; MFA the CMS-03B-09 step-up tests of AC-048.

### R-502 Shared rationale for S1-04 to S1-07, S2-01 to S2-06 and S3-089 (response-contract failure is 502, not 422)

The locked text says "422 response-contract failure" (BE03b:284, :289, :291, :299 and the matrix); the global rule says 502. BE00:590: "`DEPENDENCY_UNAVAILABLE` uses 502 when a contacted dependency returns an invalid response"; BE00:585 (provider adapter: 502 invalid upstream response); BE03a:2577 and :2718 repeat it, and BE00:577 reserves 422 for request parse and semantic validation. Every shipped route, Slice 10 and Slice 11, answers a schema-breaking port payload as 502 `DEPENDENCY_UNAVAILABLE`: `apps/worker/src/cms-editorial/workflow-read.ts:236`, `workflow-command.ts`, `conflict-detail-routes.ts:182`, `detail-routes.ts:206`, `list-routes.ts:199`, `authoring-context-routes.ts:197-230`, `history-routes.ts:214`, `restore-routes.ts:222`, `conflict-routes.ts:209`, `create-routes.ts:174`; the runbook already says so (`docs/runbooks/platform/cms-editorial.md:178`). A 422 would tell the client its own input was wrong when the server's payload broke, and would hide the fault from the BAD_GATEWAY burst alert (runbook :381). Options and trade-offs: `docs/handoffs/2026-10-10-claude-s11/lane-worker-report.md` Item 1 (this is its option B). The ruling is pending in STATE.md. Code name: see N-1.

Shared effect: no code change. The single token `RESPONSE_BOUND_STATUS` is already 502 (`apps/worker/src/cms-editorial/workflow-read-breach.test-support.ts:25`); after ratification the pending-ruling comment at `:17-25` is rewritten to cite the ratification. The breach suites `workflow-read-breach-workflow.test.ts`, `-review.test.ts` and `-queue.test.ts` are cited under the response clause of each criterion, so the ledger limitations (ledger-refresh-report.md:96-99, review-a-ledger-refutation.md:117-123) are removed.

### S1-04 P2-S11-AC-050 (422 to 502)

CURRENT (tracker line, copied byte-for-byte up to the source links):

```text
- [ ] **P2-S11-AC-050** — CMS-03B-15 accepts only a UUID `entryId` path and an optional UUID `revisionId` query member (default: the entry's current draft revision), rejects any other query key as 400 and a body as 415, accepts neither `Idempotency-Key` nor `If-Match`, answers a `revisionId` of another entry with the same 404 as an absent one, and refuses a response as a 422 response-contract failure when `preparation` is non-null for a revision that is not a submittable `draft`, when it exceeds 17 preflight results, 16 schedules or 64 publications, or when the `dependencyManifest` or `versionSet` breaks the locked Slice 10 contracts.
```

PROPOSED:

```text
- [ ] **P2-S11-AC-050** — CMS-03B-15 accepts only a UUID `entryId` path and an optional UUID `revisionId` query member (default: the entry's current draft revision), rejects any other query key as 400 and a body as 415, accepts neither `Idempotency-Key` nor `If-Match`, answers a `revisionId` of another entry with the same 404 as an absent one, and refuses a response as a 502 `DEPENDENCY_UNAVAILABLE` response-contract failure when `preparation` is non-null for a revision that is not a submittable `draft`, when it exceeds 17 preflight results, 16 schedules or 64 publications, or when the `dependencyManifest` or `versionSet` breaks the locked Slice 10 contracts.
```

DELTA (exact fragments replaced):

```text
- refuses a response as a 422 response-contract failure when `preparation`
+ refuses a response as a 502 `DEPENDENCY_UNAVAILABLE` response-contract failure when `preparation`
```

WHY: R-502 applies. The locked text is BE03b:289 (CMS-03B-15 "response bounds") and AC-050 repeats it. The breach cases the criterion names (a preparation on a non-draft revision, 18 preflight results, 17 schedules, 65 publications, a broken manifest, a broken version set) are the cases `workflow-read-breach-workflow.test.ts` drives and asserts as 502.

EFFECT: See R-502 for the shared effect. Here: the ledger limitation (ledger-refresh-report.md:96-99) is removed and AC-050 becomes verified. BE03b rows 289 and 1918 change in Section 2 (S2-02, S2-05).

### S1-05 P2-S11-AC-053 (422 to 502)

CURRENT (tracker line, copied byte-for-byte up to the source links):

```text
- [ ] **P2-S11-AC-053** — CMS-03B-15 maps malformed path or query (400), missing or expired session (401), workflow read scope (403), concealment (404), a body sent (415), a response-bound failure (422), the read limit (429), read dependency or deadline (502/503/504) and an internal failure (500, empty details) to typed ApiError; it reports an unavailable preflight provider inside `preparation.preflight` as an `unavailable` result and never as a failure of the read; and it writes no audit or outbox effect, so concealment stays 404 on refetch.
```

PROPOSED:

```text
- [ ] **P2-S11-AC-053** — CMS-03B-15 maps malformed path or query (400), missing or expired session (401), workflow read scope (403), concealment (404), a body sent (415), a response-bound failure (502 `DEPENDENCY_UNAVAILABLE`), the read limit (429), read dependency or deadline (502/503/504) and an internal failure (500, empty details) to typed ApiError; it reports an unavailable preflight provider inside `preparation.preflight` as an `unavailable` result and never as a failure of the read; and it writes no audit or outbox effect, so concealment stays 404 on refetch.
```

DELTA (exact fragments replaced):

```text
- a response-bound failure (422),
+ a response-bound failure (502 `DEPENDENCY_UNAVAILABLE`),
```

WHY: R-502 applies. AC-053 also lists "read dependency or deadline (502/503/504)"; after the change a response-contract breach and an invalid dependency answer both surface as 502, which is the BE00:590 meaning (invalid upstream response). That clause is not edited.

EFFECT: See R-502 for the shared effect. Here: the limitation is removed. Separate from this wording: the ledger refresh notes AC-053's 500/502/504 envelope proof is the shared per-row tests, not a dedicated CMS-03B-15 case; that stays a possible small test addition and is not part of this change.

### S1-06 P2-S11-AC-056 (422 to 502)

CURRENT (tracker line, copied byte-for-byte up to the source links):

```text
- [ ] **P2-S11-AC-056** — CMS-03B-16 accepts only a UUID `reviewId` path with no query key (400 otherwise) and refuses a response as a 422 response-contract failure when it breaks the review invariants (`invalidatedReason` exactly when `invalidated`, `decidedAt` exactly when `approved` or `rejected`, `recordedDecisionCount` at most `requiredDecisionCount`, a `protected` review requiring at least 2 decisions, count and risk class equal to the frozen workflow policy), carries more than 8 decisions or 32 assignments, or exposes a decision member beyond `id`, `decision`, `capability`, `decidedAt`, `mine` and `reason`.
```

PROPOSED:

```text
- [ ] **P2-S11-AC-056** — CMS-03B-16 accepts only a UUID `reviewId` path with no query key (400 otherwise) and refuses a response as a 502 `DEPENDENCY_UNAVAILABLE` response-contract failure when it breaks the review invariants (`invalidatedReason` exactly when `invalidated`, `decidedAt` exactly when `approved` or `rejected`, `recordedDecisionCount` at most `requiredDecisionCount`, a `protected` review requiring at least 2 decisions, count and risk class equal to the frozen workflow policy), carries more than 8 decisions or 32 assignments, or exposes a decision member beyond `id`, `decision`, `capability`, `decidedAt`, `mine` and `reason`.
```

DELTA (exact fragments replaced):

```text
- refuses a response as a 422 response-contract failure when it breaks
+ refuses a response as a 502 `DEPENDENCY_UNAVAILABLE` response-contract failure when it breaks
```

WHY: R-502 applies. The invariants the criterion lists (invalidatedReason, decidedAt, recorded against required, protected needing 2 decisions, 8 decisions, 32 assignments, the decision member allowlist) are the cases `workflow-read-breach-review.test.ts` drives.

EFFECT: See R-502 for the shared effect. Here: the limitation is removed and AC-056 becomes verified. BE03b rows 291 and 1919 change in Section 2 (S2-03, S2-05).

### S1-07 P2-S11-AC-059 (name the status; optional if S2-05 is approved)

CURRENT (tracker line, copied byte-for-byte up to the source links):

```text
- [ ] **P2-S11-AC-059** — CMS-03B-16 maps a malformed path or query, a missing or expired session, a missing review read scope, concealment, an unsupported body, a response-bound failure, the read limit, a read dependency or deadline and an internal failure to typed ApiError, writes no audit or outbox effect, and keeps a concealed review a 404 on every refetch.
```

PROPOSED:

```text
- [ ] **P2-S11-AC-059** — CMS-03B-16 maps a malformed path or query, a missing or expired session, a missing review read scope, concealment, an unsupported body, a response-bound failure (502 `DEPENDENCY_UNAVAILABLE`), the read limit, a read dependency or deadline and an internal failure to typed ApiError, writes no audit or outbox effect, and keeps a concealed review a 404 on every refetch.
```

DELTA (exact fragments replaced):

```text
- an unsupported body, a response-bound failure, the read limit,
+ an unsupported body, a response-bound failure (502 `DEPENDENCY_UNAVAILABLE`), the read limit,
```

WHY: AC-059 states no status, but it cites BE03b "Contract and error matrix" whose CMS-03B-16 row says 422 for response bounds (review-a-ledger-refutation.md:117-123, A-M5; the breach tests even carry the `[P2-S11-AC-059]` marker and assert 502). Fixing the matrix (S2-05) alone resolves the contradiction; naming the status here makes the criterion match AC-053, which enumerates statuses. Same ruling as S1-04.

EFFECT: No code change. The AC-059 entry stays verified once the matrix says 502; the A-M5 limitation is not needed. If the owner prefers the minimal path, approve S2-05 and strike S1-07: the criterion text then needs no change.

### S1-08 P2-S11-AC-070 (DEC-161)

CURRENT (tracker line, copied byte-for-byte up to the source links):

```text
- [ ] **P2-S11-AC-070** — CMS-03B-18 requires an `Idempotency-Key` and the exact review-version `If-Match`, locks the review row, leaves the review `version` unchanged on create and revoke, enforces rate buckets of 10/min/user and 20/min/party, a 15,000 ms deadline, no-store and Tier 2, and commits the assignment change, its audit record and exactly one `cms.entry.review-changed.v1` atomically.
```

PROPOSED:

```text
- [ ] **P2-S11-AC-070** — CMS-03B-18 requires an `Idempotency-Key` and the exact review-version `If-Match`, locks the review row, leaves the review `version` unchanged on create and on every revoke except that of a counted approver's assignment, which invalidates the open review `reviewer_authority_changed` in the same transaction (DEC-161; review `version` + 1, its own audit record and its own `cms.entry.review-changed.v1`), enforces rate buckets of 10/min/user and 20/min/party, a 15,000 ms deadline, no-store and Tier 2, and commits the assignment change, its audit record and exactly one `cms.entry.review-changed.v1` atomically (the invalidation adds its own record and event).
```

DELTA (exact fragments replaced):

```text
- leaves the review `version` unchanged on create and revoke, enforces rate buckets
+ leaves the review `version` unchanged on create and on every revoke except that of a counted approver's assignment, which invalidates the open review `reviewer_authority_changed` in the same transaction (DEC-161; review `version` + 1, its own audit record and its own `cms.entry.review-changed.v1`), enforces rate buckets
```
```text
- exactly one `cms.entry.review-changed.v1` atomically.
+ exactly one `cms.entry.review-changed.v1` atomically (the invalidation adds its own record and event).
```

WHY: DEC-161 (decisions.md:2341-2353) chose the specific invalidation row (BE03b:1872, AC-112) over the general "does not change the review version" rule; the shipped revoke of a counted approve does exactly that. The test asserts review `invalidated/3/1`, two review-changed events at versions 2 and 3 and two audit records (`supabase/tests/phase_02_slice_11_rpc_review_assign_authority.sql:69-95`). AC-112 (tracker line 465) already states the DEC-161 behaviour; AC-070 contradicts it (review-a-ledger-refutation.md:105-115, A-M4). Four BE03b sites still carry the old rule (S2-07 to S2-10).

EFFECT: No behaviour change. AC-070 returns from "refuted" to verifiable: clauses 2 and 5 cite the counted-revoke test above (`:69-95`), the uncounted-revoke control in the same file, `supabase/tests/phase_02_slice_11_criteria_assignment_revoke.sql` and `tests/postgrest/phase-02-slice-11-assignment-lifecycle.apispec.ts` ("create and ordinary revoke ... unchanged review operand"). Housekeeping: the `comment on function` in `supabase/migrations/20261005017620_cms_assign_editorial_reviewer.sql` still says "the review version never advances"; correct it with the next migration touching that function, not as a behaviour change.

### S1-09 P2-S11-AC-090 (executor returns its typed result)

CURRENT (tracker line, copied byte-for-byte up to the source links):

```text
- [ ] **P2-S11-AC-090** — Frozen dependency manifest (E1): a frozen identity is current only when its source still serves it (schema version `active` with an equal artifact hash; template and pattern versions `active` with equal hashes; taxonomy versions `active`; blocks `supported` or `deprecated`, never `withdrawn`; settings snapshot equal), and a command that relies on a frozen set (CMS-03B-07, CMS-03B-09, the executor) and finds a non-current identity or a differing recomputed manifest returns 409 `CONFLICT` `version_set_stale` and invalidates the review `dependency_changed`.
```

PROPOSED:

```text
- [ ] **P2-S11-AC-090** — Frozen dependency manifest (E1): a frozen identity is current only when its source still serves it (schema version `active` with an equal artifact hash; template and pattern versions `active` with equal hashes; taxonomy versions `active`; blocks `supported` or `deprecated`, never `withdrawn`; settings snapshot equal), and a command that relies on a frozen set (CMS-03B-07, CMS-03B-09) and finds a non-current identity or a differing recomputed manifest returns 409 `CONFLICT` `version_set_stale`, while the executor (internal CMS-03B-20, which returns typed results instead of ApiError) returns its typed `blocked` result with `reasonCode` `approval_invalidated`; all three invalidate the review `dependency_changed`.
```

DELTA (exact fragments replaced):

```text
- a command that relies on a frozen set (CMS-03B-07, CMS-03B-09, the executor) and finds a non-current identity or a differing recomputed manifest returns 409 `CONFLICT` `version_set_stale` and invalidates the review `dependency_changed`.
+ a command that relies on a frozen set (CMS-03B-07, CMS-03B-09) and finds a non-current identity or a differing recomputed manifest returns 409 `CONFLICT` `version_set_stale`, while the executor (internal CMS-03B-20, which returns typed results instead of ApiError) returns its typed `blocked` result with `reasonCode` `approval_invalidated`; all three invalidate the review `dependency_changed`.
```

WHY: BE03b:1783 lists the executor among the commands that return 409, while BE03b:1927 says the internal operations return typed results instead of ApiError and `ScheduleExecutionResult` has no 409 (review-a-ledger-refutation.md:277; ledger-refresh-report.md:102-105). The executor already invalidates `dependency_changed` and blocks the schedule `approval_invalidated` (`supabase/migrations/20261005017740_cms_execute_publication_schedule.sql:183-189`). DEC-169 (decisions.md:2425) fixed the CMS-03B-07/09 side: committed 409 plus `dependency_changed` invalidation.

EFFECT: No code change. The uncited executor clause becomes provable: `supabase/tests/phase_02_slice_11_rpc_publication_execute_refusals.sql` ("a frozen manifest that is no longer current invalidates the review (dependency_changed) and blocks the schedule approval_invalidated") and `supabase/tests/phase_02_slice_11_criteria_publish_gates.sql` (schema, template, block, settings executor gates). AC-090 goes from partial to verified after re-tiling. BE03b:1783 changes in S2-11. Optional, not drafted: the criterion's currency list omits the DEC-170 locale-source rule that BE03b:1783 now carries (N-4).

### S1-10 P2-S11-AC-097 (DEC-169 lapsed approver)

CURRENT (tracker line, copied byte-for-byte up to the source links):

```text
- [ ] **P2-S11-AC-097** — Publication preflight registry (D19): every category is evaluated with no short circuit and the report lists all 17; any `failed` category refuses the command 422 `VALIDATION_FAILED` `preflight_failed` with `details.preflight` of at most 17 `{ category, outcome, reasonCode }` entries and no counts or finding text; otherwise any `unavailable` category refuses it 503 `DEPENDENCY_UNAVAILABLE` with `dependencyClass` `preflight` and `retryable` true; in both cases nothing commits and no success idempotency record is retained, while at execution `failed` blocks the schedule and `unavailable` retries it.
```

PROPOSED:

```text
- [ ] **P2-S11-AC-097** — Publication preflight registry (D19): every category is evaluated with no short circuit and the report lists all 17; any `failed` category refuses the command 422 `VALIDATION_FAILED` `preflight_failed` with `details.preflight` of at most 17 `{ category, outcome, reasonCode }` entries and no counts or finding text; otherwise any `unavailable` category refuses it 503 `DEPENDENCY_UNAVAILABLE` with `dependencyClass` `preflight` and `retryable` true; in both cases nothing commits and no success idempotency record is retained, except that a `failed` `revocation` category found lazily because a counted approver's standing grant lapsed commits the review invalidation `reviewer_authority_changed`, the cancellation of the review's `pending` and `failed_retryable` schedules (`approval_invalidated`) and the refusal itself as the replayable idempotency outcome (DEC-169), while at execution `failed` blocks the schedule and `unavailable` retries it.
```

DELTA (exact fragments replaced):

```text
- in both cases nothing commits and no success idempotency record is retained, while at execution
+ in both cases nothing commits and no success idempotency record is retained, except that a `failed` `revocation` category found lazily because a counted approver's standing grant lapsed commits the review invalidation `reviewer_authority_changed`, the cancellation of the review's `pending` and `failed_retryable` schedules (`approval_invalidated`) and the refusal itself as the replayable idempotency outcome (DEC-169), while at execution
```

WHY: DEC-169 (decisions.md:2425-2437) rules that a lapsed counted approver is a committed `preflight_failed` refusal with a `reviewer_authority_changed` invalidation and schedule cancellation, so "nothing commits" is false for that one case (review-a-ledger-refutation.md:125-135, A-M6). The tests: review invalidated at version 3 with one event, pending schedule cancelled `approval_invalidated`, reservation `completed/422` (`supabase/tests/phase_02_slice_11_rpc_publication_publish_refusals.sql:257-284`, schedule twin `..._schedule_refusals.sql:301-`). BE03b:1817 says the same "nothing commits" (S2-12).

EFFECT: No code change. The ledger entry is split into the raised-refusal clause (existing "every raised refusal left no ..." titles) and the committed-refusal exception (the lapse tests above and `apps/worker/src/cms-editorial/publication-committed-refusals.test.ts`); `failed_retryable` cancellation is already asserted in `supabase/tests/phase_02_slice_11_helpers_invalidation.sql:195-204`. AC-097 stays verified with an honest exception instead of a hidden one.

### S1-11 P2-S11-AC-122 (DEC-171 seven-column identity)

CURRENT (tracker line, copied byte-for-byte up to the source links):

```text
- [ ] **P2-S11-AC-122** — Persistence `cms_publication_schedules`: `state` is one of `pending`, `executing`, `completed`, `failed_retryable`, `blocked`, `cancelled`; `reason_code` is non-null exactly for `blocked` and `cancelled` and one of the six closed tokens; `attempt_count` is 0 to 3; `audience` follows `^[a-z0-9_-]{1,48}$`; `expected_version` is the approved review's version at acceptance; `UNIQUE(entry_id, revision_id, action, local_datetime, timezone, audience)` prevents a duplicate schedule; the lease, retry and `actual_at_utc`/`deviation_seconds` columns exist; and `owner_id` and `created_by` are server-derived with worker and command CAS on `state` and `version`.
```

PROPOSED:

```text
- [ ] **P2-S11-AC-122** — Persistence `cms_publication_schedules`: `state` is one of `pending`, `executing`, `completed`, `failed_retryable`, `blocked`, `cancelled`; `reason_code` is non-null exactly for `blocked` and `cancelled` and one of the six closed tokens; `attempt_count` is 0 to 3; `audience` follows `^[a-z0-9_-]{1,48}$`; `expected_version` is the approved review's version at acceptance; `UNIQUE(entry_id, revision_id, action, local_datetime, local_datetime_submicro_ns, timezone, audience)` prevents a duplicate schedule (the exact local datetime is the microsecond column plus its private sub-microsecond remainder); the lease, retry and `actual_at_utc`/`deviation_seconds` columns exist; and `owner_id` and `created_by` are server-derived with worker and command CAS on `state` and `version`.
```

DELTA (exact fragments replaced):

```text
- `UNIQUE(entry_id, revision_id, action, local_datetime, timezone, audience)` prevents a duplicate schedule
+ `UNIQUE(entry_id, revision_id, action, local_datetime, local_datetime_submicro_ns, timezone, audience)` prevents a duplicate schedule (the exact local datetime is the microsecond column plus its private sub-microsecond remainder)
```

WHY: The shipped key is seven columns: `supabase/migrations/20261010150000_cms_schedule_precision_storage.sql:26-27`, asserted by `supabase/tests/phase_02_slice_11_schedules_schema.sql:86-88`. BE03b:1991 and its changelog row (:2266) already state it as DEC-171; the criterion was never updated, so the literal clause is contradicted by its own cited test (review-a-ledger-refutation.md:150-157, A-M8). The parenthetical is BE03b:1991 verbatim.

EFFECT: No code change. Re-tile the ledger clause; it cites the schema assertion above and `tests/postgrest/phase-02-slice-11-schedule-precision.apispec.ts:350` ("identities one nanosecond apart coexist as two exact stored pairs"). Companion spec edit: BE03b:159 still lists the old identity (S2-13). The DEC-171 record itself is missing (N-3).

## Section 2: matching BE03b spec text edits (14 items)

All edits are to `.memory/wiki/specs/be/03b-editorial-workflow-publication.md`. A pure-text edit; no code. Run `/propagate-decision` or the kit's consistency check after applying so the semantic index (`.memory/schema/*`) regenerates.

### S2-01 CMS-03B-12 paths / preimages (Slice 10 row): last cell 422 to 502

Line(s): BE03b:284

CURRENT:

```text
CMS-03B-12 | paths / preimages | at most 128 `ConflictDetailPath` entries; each side value bounded to 256 KiB total and schema-typed against its side's `schemaVersionId`; only an `open` conflict is readable (a resolved or superseded conflict is the same 404 as an absent one); no ownership identifier is serialized | 422 response-contract failure
```

PROPOSED:

```text
CMS-03B-12 | paths / preimages | at most 128 `ConflictDetailPath` entries; each side value bounded to 256 KiB total and schema-typed against its side's `schemaVersionId`; only an `open` conflict is readable (a resolved or superseded conflict is the same 404 as an absent one); no ownership identifier is serialized | 502 `DEPENDENCY_UNAVAILABLE` response-contract failure
```

WHY: R-502 (BE00:590; every shipped route answers 502). This Slice 10 row is verified work: its worker route already answers 502 (`conflict-detail-routes.ts:182`, test `[P2-S10-AC-092] maps ... an invalid response to 502`). It also fixes the wording of P2-S10-AC-089 (S3-089).

### S2-02 CMS-03B-15 response bounds: last cell 422 to 502

Line(s): BE03b:289

CURRENT:

```text
CMS-03B-15 | response bounds | `preparation` is non-null only when the revision's effective state is `draft` and the caller may submit; at most 17 preflight results, 16 schedules and 64 publications; `dependencyManifest` and `versionSet` satisfy the Slice 10 locked contracts | 422 response-contract failure
```

PROPOSED:

```text
CMS-03B-15 | response bounds | `preparation` is non-null only when the revision's effective state is `draft` and the caller may submit; at most 17 preflight results, 16 schedules and 64 publications; `dependencyManifest` and `versionSet` satisfy the Slice 10 locked contracts | 502 `DEPENDENCY_UNAVAILABLE` response-contract failure
```

WHY: R-502 (BE00:590; every shipped route answers 502).

### S2-03 CMS-03B-16 decisions / assignments: last cell 422 to 502

Line(s): BE03b:291

CURRENT:

```text
CMS-03B-16 | decisions / assignments | at most 8 decisions and 32 assignments; a decision exposes `id`, `decision`, `capability`, `decidedAt` and `mine`, and `reason` only on the caller's own decision; `assignments` is non-empty only for the receipt-derived owner and carries no person, actor or party identifier | 422 response-contract failure
```

PROPOSED:

```text
CMS-03B-16 | decisions / assignments | at most 8 decisions and 32 assignments; a decision exposes `id`, `decision`, `capability`, `decidedAt` and `mine`, and `reason` only on the caller's own decision; `assignments` is non-empty only for the receipt-derived owner and carries no person, actor or party identifier | 502 `DEPENDENCY_UNAVAILABLE` response-contract failure
```

WHY: R-502 (BE00:590; every shipped route answers 502).

### S2-04 All browser responses envelope: last cell 422 to 502

Line(s): BE03b:299

CURRENT:

```text
All browser responses | state/ownership envelope | ResourceMeta contains only id, version, and timestamps; EntryRevision, EditorialReview, PublicationSchedule, Publication, and RevisionSummary use their exact closed state enums; ownership and approval authority evidence is absent | 422 response-contract failure
```

PROPOSED:

```text
All browser responses | state/ownership envelope | ResourceMeta contains only id, version, and timestamps; EntryRevision, EditorialReview, PublicationSchedule, Publication, and RevisionSummary use their exact closed state enums; ownership and approval authority evidence is absent | 502 `DEPENDENCY_UNAVAILABLE` response-contract failure
```

WHY: R-502 (BE00:590; every shipped route answers 502). Applies to every browser response, which is why it is listed even though no criterion cites it by name.

### S2-05 Contract and error matrix, Slice 11 reads (CMS-03B-15, CMS-03B-16)

- BE03b:1918 (CMS-03B-15): 422 cell `response bounds` becomes `not applicable to bounded read`; 502/503/504 cell `read dependency/deadline` becomes `read dependency/deadline, response-contract breach (BAD_GATEWAY)`.
- BE03b:1919 (CMS-03B-16): 422 cell `response bounds` becomes `not applicable to bounded read`; 502/503/504 cell `read dependency/deadline` becomes `read dependency/deadline, response-contract breach (BAD_GATEWAY)`.

WHY: R-502 (BE00:590; every shipped route answers 502). Request-side 422 for these reads does not exist (strict query and path errors are 400), so the 422 cell only ever described the response bound. "not applicable to bounded read" is the phrase already used in the 409 cell of the same rows.

### S2-06 Contract and error matrix, Slice 10 reads (CMS-03B-11, CMS-03B-12, CMS-03B-14)

- BE03b:1914 (CMS-03B-11): 422 cell `response/field bounds` becomes `not applicable to bounded read`; 502/503/504 cell `read dependency/deadline` becomes `read dependency/deadline, response-contract breach (BAD_GATEWAY)`.
- BE03b:1915 (CMS-03B-12): 422 cell `response/path bounds` becomes `not applicable to bounded read`; 502/503/504 cell `read dependency/deadline` becomes `read dependency/deadline, response-contract breach (BAD_GATEWAY)`.
- BE03b:1917 (CMS-03B-14): 422 cell `response/field bounds` becomes `not applicable to bounded read`; 502/503/504 cell `read dependency/deadline` becomes `read dependency/deadline, response-contract breach (BAD_GATEWAY)`.

WHY: R-502 (BE00:590; every shipped route answers 502). Request-side 422 for these reads does not exist (strict query and path errors are 400), so the 422 cell only ever described the response bound. "not applicable to bounded read" is the phrase already used in the 409 cell of the same rows.

### S2-07 If-Match operands: assignment changes and the review version (DEC-161)

Line(s): BE03b:193 (sentence inside the "If-Match operands (single definition)" bullet)

CURRENT:

```text
CMS-03B-18 create and revoke do not advance the review `version`; a decision serializes with assignment changes by locking the review row.
```

PROPOSED:

```text
CMS-03B-18 create and revoke do not advance the review `version`, except that revoking a counted approver's assignment invalidates the open review `reviewer_authority_changed` (DEC-161), which advances it by one in the same transaction; a decision serializes with assignment changes by locking the review row.
```

WHY: DEC-161 (decisions.md:2341). The sentence contradicts BE03b:1872 (the invalidation table already lists the assignment revoke) and the shipped revoke path.

### S2-08 Assignment (CMS-03B-18) paragraph: counted revoke (DEC-161)

Line(s): BE03b:1858 (last two sentences of the paragraph)

CURRENT:

```text
both write the audit record and one `cms.entry.review-changed.v1` and take the review row lock. A revoke of an assignment whose human already recorded an approve decision on an `open` review removes that decision from the qualifying count at the next recount.
```

PROPOSED:

```text
both write the audit record and one `cms.entry.review-changed.v1`, take the review row lock and leave the review state and `version` unchanged, except that a revoke of an assignment that authorized a counted approve decision on the `open` review invalidates the review `reviewer_authority_changed` in the same transaction (DEC-161, `Review invalidation`): the review becomes `invalidated` at `version` + 1, the invalidation writes its own audit record and its own `cms.entry.review-changed.v1`, and the revoke still answers 200 with the assignment resource. A revoke of any other assignment (no decision, a reject, or an approve that no longer counts) changes no review state.
```

WHY: DEC-161. The current last sentence says a counted approve is merely recounted, which DEC-161 rejected (option B, "rejected: contradicts the explicit invalidation row"). The qualifying-approvers paragraph (BE03b:1862) is consistent and needs no edit.

### S2-09 State machine: EditorialReview sentence (DEC-161)

Line(s): BE03b:2093

CURRENT:

```text
reviewer assignment create/revoke does not change the review state or version.
```

PROPOSED:

```text
reviewer assignment create/revoke does not change the review state or version, except that revoking the assignment of a counted approver on an `open` review invalidates it `reviewer_authority_changed` (DEC-161).
```

WHY: DEC-161; same contradiction with BE03b:1872.

### S2-10 Verification list: reviewer decision matrix wording (DEC-161)

Line(s): BE03b:2184 (fragment inside the CMS-03B-06 decision-matrix bullet)

CURRENT:

```text
assignment revocation unwinding an open review's count,
```

PROPOSED:

```text
assignment revocation of a counted approver invalidating the open review `reviewer_authority_changed` with its own event (DEC-161) and of any other assignment changing nothing,
```

WHY: DEC-161. "Unwinding" describes the rejected recount-only option; the shipped test (`phase_02_slice_11_rpc_review_assign_authority.sql:69-95`) asserts invalidation.

### S2-11 Frozen dependency manifest: currency paragraph (executor)

Line(s): BE03b:1783 (last sentence of the "A frozen identity is current" paragraph; formerly cited as :1773)

CURRENT:

```text
A command that relies on a frozen set (CMS-03B-07, CMS-03B-09, the executor) requires every identity to be current and the recomputed manifest to equal the frozen one; a non-current identity or a differing hash is 409 `CONFLICT` `version_set_stale` and the review is invalidated `dependency_changed` (`Review invalidation`).
```

PROPOSED:

```text
A command that relies on a frozen set (CMS-03B-07, CMS-03B-09) requires every identity to be current and the recomputed manifest to equal the frozen one; a non-current identity or a differing hash is 409 `CONFLICT` `version_set_stale` and the review is invalidated `dependency_changed` (`Review invalidation`). The executor (CMS-03B-20, an internal operation that returns typed results instead of ApiError) requires the same and, on a non-current identity or a differing hash, invalidates the review `dependency_changed` and returns the typed `blocked` result with `reasonCode` `approval_invalidated`.
```

WHY: BE03b:1927 says internal operations return typed results; BE03b:1892 (execution step 2) already blocks `approval_invalidated`. The sentence puts the executor in the wrong group. Supports S1-09.

### S2-12 Publication preflight aggregation (DEC-169)

Line(s): BE03b:1817

CURRENT:

```text
in both cases nothing commits and no idempotency record is retained as a success.
```

PROPOSED:

```text
in both cases nothing commits and no idempotency record is retained as a success, except that a `failed` `revocation` category found lazily because a counted approver's standing grant lapsed (schedule and publish phases) commits the review invalidation `reviewer_authority_changed` with the cancellation of the review's `pending` and `failed_retryable` schedules (`Review invalidation`), and the refusal is then recorded as the replayable completed idempotency outcome (a committed refusal, DEC-159, DEC-169).
```

WHY: DEC-169 (decisions.md:2425). BE03b:1872 already lists "lapses (found lazily by the `revocation` preflight)" as an invalidation producer, so the two paragraphs disagree today. DEC-159 (BE03b:2264) already defines the committed-refusal envelope. Supports S1-10.

### S2-13 CMS-03B-07 registry row: concurrency cell (DEC-171)

Line(s): BE03b:159 (concurrency/idempotency cell of the CMS-03B-07 row)

CURRENT:

```text
unique (entry, revision, action, local time, timezone, audience)
```

PROPOSED:

```text
unique (entry, revision, action, local time including its sub-microsecond remainder, timezone, audience)
```

WHY: BE03b:1991 and the :2266 changelog already carry the seven-column key; the registry row still lists the old identity. Supports S1-11. DEC-171 needs no further spec edit: :1991 is already correct.

### S2-14 Changelog row for this batch

Line: new last row of the BE03b changelog table (after :2268). Proposed row (date and DEC id are the owner's to fill on ratification):

```text
| 2026-10-11 | Slice 11 wording reconciliation (owner ratified; DEC-155, DEC-161, DEC-164, DEC-169, DEC-171). A schema-breaking dependency payload on a safe read is 502 `DEPENDENCY_UNAVAILABLE`, not 422 (BE00:590); revoking a counted approver's assignment invalidates the open review `reviewer_authority_changed` (version + 1, its own event); the executor returns its typed `blocked`/`approval_invalidated` result on a non-current frozen set while CMS-03B-07/09 return the committed 409 `version_set_stale`; a lazily found lapsed counted approver is a committed `preflight_failed` refusal with invalidation and schedule cancellation; the schedule identity key carries `local_datetime_submicro_ns`. | /propagate-decision | Route field validation matrix, Contract and error matrix, If-Match operands, Assignment, Frozen dependency manifest, Publication preflight registry, State machine, Verification, Changelog |
```

WHY: every other spec change in the repository is logged in this table (see :2258-2268). Strike if the owner prefers the changelog written at apply time.

## Section 3: DEC-147 Slice 10 set (12 items; owner has not chosen between A and C)

Status as of the Slice 10 ledger: all twelve are `partial` with "pending DEC-147" or a wording limitation (`tests/contracts/phase-02-slice-10-evidence-ledger-{001-035,036-070,071-105}.ts`). Question asked here: with the Slice 11 runtime now built on this branch, is each criterion as worded provable, or genuinely defective? "Provable" means a test that exists today (or needs only a ledger citation, or one small named test) proves every testable clause. Wording that no test can ever prove is "defective". A scope sentence of the form "This is a contract-only ... rule until the protected operation exists" is a condition, not a testable clause, and is not treated as a defect unless it names the wrong operation.

Under option C the Slice 10 ledger entries cite the Slice 11 tests directly (the Slice 10 ledger does not require a criterion marker in a cited title; many existing citations have none) and the Slice 10 receipts are regenerated. Slice 10 closure then depends on the Slice 11 tests staying green. Under option A none of that is needed, at the price of new receiving criteria.

### S3-030 P2-S10-AC-030: DEFECTIVE (block clause vs the locked pointer grammar)

Tracker/plan text today (byte-for-byte up to the source link):

```text
- [ ] **P2-S10-AC-030** — Enforce CMS-03B-01: changedPaths; 1–128 unique JSON Pointers, each 1–256 chars, bound to stable field/block/relation IDs; 422. Relation changes are keyed by stable field ID rather than version-specific relation-definition ID.
```

Slice 10 ledger today: partial, "Pending DEC-147 forward-scope ruling"; the "bound to stable field/block/relation IDs" clause is uncited because no block pointer can be written in Slice 10.

Provable on this branch: Everything except the block half: `/fields/{stableFieldId}` pointers for every field kind including relation, 1-128 unique, 422 otherwise, `/blocks/...` refused (already cited in the Slice 10 ledger; the CMS-03B-01 append path is Slice 10 runtime).

PROPOSED (genuinely defective text only):

```text
- [ ] **P2-S10-AC-030** — Enforce CMS-03B-01: changedPaths; 1–128 unique JSON Pointers, each `/fields/{stableFieldId}` (lowercase UUID, 44 characters; every field kind including relation); `/blocks/...` and every other pointer is refused until a composition write path exists; 422. Relation changes are keyed by stable field ID rather than version-specific relation-definition ID.
```

DELTA:

```text
- each 1–256 chars, bound to stable field/block/relation IDs; 422.
+ each `/fields/{stableFieldId}` (lowercase UUID, 44 characters; every field kind including relation); `/blocks/...` and every other pointer is refused until a composition write path exists; 422.
```

WHY: The locked grammar is BE03b:251 and :1538 ("`/blocks/…` is refused by CMS-03B-01 until a composition write path exists (03c owns composition writes)"). No Slice 11 operation changes this, and the composition write path belongs to Slice 12, which is unstarted on this branch. "Bound to ... block IDs" therefore contradicts the locked rule and can never be proven in Slice 10 or 11. (The brief pairs this item with BE04c; the changedPaths grammar is in BE03b. BE04c holds the audience grammar that matters for AC-047.)

EFFECT: Under C or A the corrected text is verified from existing citations. Under A, add one S12 receiving criterion: CMS-03B-01 accepts `/blocks/{compositionInstancePath}` changedPaths once the composition write path exists (grammar at BE03b:1704).

### S3-038 P2-S10-AC-038: PROVABLE NOW

Tracker/plan text today (byte-for-byte up to the source link):

```text
- [ ] **P2-S10-AC-038** — Enforce CMS-03B-05: frozenHash; exactly 64 lowercase hex; must equal normalized revision hash; 422/409. This is a contract-only dependency-manifest rule; runtime completion requires the served preparation and write path.
```

Slice 10 ledger today: partial; "must equal normalized revision hash" and "409" uncited because no CMS-03B-05 route existed.

Provable on this branch: CMS-03B-05 (submit) is built. Format and mismatch: `supabase/tests/phase_02_slice_11_rpc_review_submit_refusals.sql:107-116,157` and `tests/postgrest/phase-02-slice-11-review-refusals.apispec.ts:123-154` (wrong frozenHash is 422 at `/frozenHash`); strict contract `tests/postgrest/phase-02-slice-11-submit-contracts.apispec.ts:83-94`; equals stored payload hash `supabase/tests/phase_02_slice_11_rpc_review_submit.sql:68`; the "409": `revision_not_submittable` `..._submit_refusals.sql:155-156` and `dependency_changed` `:171-175`. The sentence "runtime completion requires the served preparation and write path" is now satisfied (CMS-03B-15 and CMS-03B-05 exist).

No wording change proposed. EFFECT: ledger citations only; status partial to verified. Option A would instead reword to the Slice 10 contract scope and add a Slice 11 receiving criterion for the equality and the two 409 reasons, which Slice 11 AC-005..AC-010 and AC-035 already prove.

### S3-040 P2-S10-AC-040: PROVABLE NOW

Tracker/plan text today (byte-for-byte up to the source link):

```text
- [ ] **P2-S10-AC-040** — Enforce CMS-03B-05: riskClass; ordinary or protected; protected requires configured two-person workflow; 422. `riskClass` is server-derived from frozen policy and dependencies; any caller-supplied `riskClass` is an unknown key.
```

Slice 10 ledger today: partial; "server-derived from frozen policy and dependencies" uncited (no CMS-03B-05 route).

Provable on this branch: Server derivation: `supabase/tests/phase_02_slice_11_rpc_review_submit.sql:63,89` (ordinary), `:184-190` (a protected policy freezes `riskClass` protected, two decisions and the specialist slot), `:72` (strictest-of policy evidence frozen); caller-supplied `riskClass` is 422 `unknown_field` at `/riskClass`: `apps/worker/src/cms-editorial/workflow-command-admission.test.ts:219-231`; protected requires two decisions: `packages/contracts/src/cms-editorial/workflow-resources.test.ts` ("requires a protected review to carry at least two decisions").

No wording change proposed. EFFECT: ledger citations only; status partial to verified. Option A: reword to "contract rejects a caller riskClass" and add a Slice 11 receiving criterion for the derivation (AC-005/AC-120 already cover it).

### S3-042 P2-S10-AC-042: PROVABLE NOW

Tracker/plan text today (byte-for-byte up to the source link):

```text
- [ ] **P2-S10-AC-042** — Enforce CMS-03B-06: stepUpAt/capability; ISO timestamp within configured MFA freshness; named reviewer capability, never caller-selected authority; 401/403/422. The caller supplies neither `stepUpAt` nor `capability`; every CMS-03B-06 decision requires server-verified recent binding-bound MFA and eligible assigned-reviewer capability.
```

Slice 10 ledger today: partial; runtime enforcement was Slice 11.

Provable on this branch: CMS-03B-06 (decision) is built. Freshness window and 401: `supabase/tests/phase_02_slice_11_rpc_review_decision_refusals.sql:84-97` (stale, future, unverified or absent proof is `STEP_UP_REQUIRED`; 590 s accepted), `tests/postgrest/phase-02-slice-11-decision-contracts.apispec.ts` and `phase-02-slice-11-decision-refusals.apispec.ts:143-166` (refused before any RPC or reservation); capability and assignment 403: `..._decision_refusals.sql:115-122` (`capability_missing`), `:147-151` (`separation_of_duties`); specialist slot from the server: `supabase/tests/phase_02_slice_11_rpc_review_decision.sql` (`specialist_slot_unsatisfiable`); caller `stepUpAt`/`capability` is an unknown key: `packages/contracts/src/cms-editorial/workflow-requests.test.ts`.

No wording change proposed. EFFECT: ledger citations only; status partial to verified. Option A: reword to the contract-level "no stepUpAt/capability member" and add a Slice 11 receiving criterion (AC-011..AC-016 and AC-046 already cover the runtime).

### S3-044 P2-S10-AC-044: PROVABLE NOW

Tracker/plan text today (byte-for-byte up to the source link):

```text
- [ ] **P2-S10-AC-044** — Enforce CMS-03B-07: resolvedUtc/tzdbVersion/disambiguation; offset ISO instant, tzdb 1–32 chars, disambiguation earlier/later/none; nonexistent local time rejected; 422. This is a contract-only publication-action rule until the protected operation exists.
```

Slice 10 ledger today: partial; "nonexistent local time rejected" unproven and the contract test pinned the opposite in Slice 10.

Provable on this branch: CMS-03B-07 time authority is built. Nonexistent local time with alternatives: `tests/postgrest/phase-02-slice-11-schedule-time.apispec.ts:89-101` and `apps/worker/src/cms-editorial/workflow-schedule-time.test.ts`; `resolved_utc_mismatch` and `tzdb_version_mismatch`: `supabase/tests/phase_02_slice_11_rpc_publication_schedule_refusals.sql` (AC-104/AC-105 titles); pinned tz data: `supabase/tests/phase_02_slice_11_helpers_tzdb.sql`; disambiguation none/earlier/later: `tests/postgrest/phase-02-slice-11-schedule-time.apispec.ts:55-90`.

No wording change proposed. EFFECT: ledger citations only; status partial to verified. The Slice 10 contract test that admits a gap time stays valid (the bare contract does not know the tz rules); the Worker time authority is what rejects it, so the ledger note changes, not the wording.

### S3-045 P2-S10-AC-045: DEFECTIVE (scope sentence names the wrong operation)

Tracker/plan text today (byte-for-byte up to the source link):

```text
- [ ] **P2-S10-AC-045** — Enforce CMS-03B-07: action; publish, unpublish, expire, or archive; 422. This is a contract-only preview-token rule until mint/open/revocation paths exist.
```

Slice 10 ledger today: partial; the final sentence is a CMS-03B-08/19 statement, so no CMS-03B-07 test can prove it (ledger limitation, "EVIDENCE GAP EB R2 045-a: ... owner to correct it").

Provable on this branch: The testable part (action is exactly publish, unpublish, expire or archive; any other value is 422 at `/action`) is provable at CMS-03B-07: `supabase/tests/phase_02_slice_11_rpc_publication_schedule_refusals.sql:98` (`delete` is `VALIDATION_FAILED` at `/action`), `supabase/tests/phase_02_slice_11_rpc_publication_schedule.sql` ("unpublish, expire and archive are scheduled against an approved review too"), `tests/postgrest/phase-02-slice-11-schedule-actions.apispec.ts`.

PROPOSED (genuinely defective text only):

```text
- [ ] **P2-S10-AC-045** — Enforce CMS-03B-07: action; publish, unpublish, expire, or archive; 422. This is a contract-only publication-action rule until the protected operation exists.
```

DELTA:

```text
- This is a contract-only preview-token rule until mint/open/revocation paths exist.
+ This is a contract-only publication-action rule until the protected operation exists.
```

WHY: The sentence belongs to AC-046/AC-047 (CMS-03B-08 preview). Attached to a CMS-03B-07 `action` rule it describes a preview-token path that has nothing to do with the clause. The replacement is the sentence AC-044 already uses for CMS-03B-07. Alternative: delete the sentence now that the operation exists.

EFFECT: Wrong under both A and C: no test can prove the current sentence. After the fix the criterion is provable from the tests listed above.

### S3-046 P2-S10-AC-046: PROVABLE NOW

Tracker/plan text today (byte-for-byte up to the source link):

```text
- [ ] **P2-S10-AC-046** — Enforce CMS-03B-08: versionSet; strict exact schema/template/taxonomy/settings/blocks/patterns IDs and hashes; 422; stale set 409. This is a contract-only bounded version-set rule until server derivation and revalidation exist.
```

Slice 10 ledger today: partial; "stale set 409" unproven because no seam derived or compared a version set.

Provable on this branch: CMS-03B-08 mint is built. Stale set is 409 `version_set_stale`: `supabase/tests/phase_02_slice_11_rpc_preview_mint_refusals.sql:213-214` ("a version set that differs from the one recomputed from canonical state ... is 409 version_set_stale") and `tests/postgrest/phase-02-slice-11-preview.apispec.ts:143-155`; server recomputation of the set: `supabase/tests/phase_02_slice_11_helpers/version-set-parity.sqlinc` and `phase_02_slice_11_helpers_version_set.sql`; the strict bounded set is already cited from Slice 10.

No wording change proposed. EFFECT: ledger citations only; status partial to verified. Option A: reword to the contract shape and add a Slice 11 receiving criterion for stale-set detection (AC-023..AC-028 and AC-090 already cover it).

### S3-047 P2-S10-AC-047: DEFECTIVE (audience bound contradicts the locked grammar)

Tracker/plan text today (byte-for-byte up to the source link):

```text
- [ ] **P2-S10-AC-047** — Enforce CMS-03B-08: audience/route; audience 1–64 safe chars; route 1–2048 normalized path; no external URL; 422. This is a contract-only preview-binding rule until the protected preview path exists.
```

Slice 10 ledger today: partial; "audience 1-64 safe chars" is unprovable because the contract enforces `^[a-z0-9_-]{1,48}$` and refuses 49-64 characters.

Provable on this branch: Route 1-2048 normalized path, no external URL, 422 at `/route`: `supabase/tests/phase_02_slice_11_rpc_preview_mint_refusals.sql:103-120` (empty, relative, URL, protocol-relative, query, fragment, backslash, control, dot and empty segments, percent-encoded separators, >2048 chars). The audience clause as worded is refused by the shipped route: `:95-100` (a 49-character audience is `VALIDATION_FAILED` at `/audience`).

PROPOSED (genuinely defective text only):

```text
- [ ] **P2-S10-AC-047** — Enforce CMS-03B-08: audience/route; audience `^[a-z0-9_-]{1,48}$` (matched as submitted, never trimmed); route 1–2048 normalized path; no external URL; 422. This is a contract-only preview-binding rule until the protected preview path exists.
```

DELTA:

```text
- audience 1–64 safe chars;
+ audience `^[a-z0-9_-]{1,48}$` (matched as submitted, never trimmed);
```

WHY: The audience grammar is locked at BE03b:272 and :268, BE04c:110 and :246, and DEC-145 (decisions.md:2116; BE03b changelog 2026-10-07). 64 is the older figure; a criterion accepting 49-64 characters contradicts the locked schema and the shipped route. The tighter wording does not weaken anything: it states what is enforced.

EFFECT: Wrong under both A and C. After the fix the criterion is provable (audience from `phase_02_slice_11_rpc_preview_mint_refusals.sql:95-100`, route from `:103-120`).

### S3-048 P2-S10-AC-048: PROVABLE NOW (one optional label fix)

Tracker/plan text today (byte-for-byte up to the source link):

```text
- [ ] **P2-S10-AC-048** — Enforce CMS-03B-09: frozenHash/expectedVersionSet; 64 lowercase hex and strict version/hash set equal to approved candidate; 422/409. This is a contract-only unpublish/expire/archive rule until the protected operation exists.
```

Slice 10 ledger today: partial; "equal to approved candidate" and "409" were runtime.

Provable on this branch: CMS-03B-09 (publish) is built. Stale expected set is 409 `version_set_stale` and a wrong frozenHash is 422 at `/frozenHash`: `tests/postgrest/phase-02-slice-11-publish.apispec.ts:239-258`; `supabase/tests/phase_02_slice_11_rpc_publication_publish_refusals.sql:91-104` (frozenHash and version-set shape) and `:183` (expectedVersionSet that is not exactly the frozen set); `supabase/tests/phase_02_slice_11_criteria_publish_gates.sql` (schema, template, block, settings gates).

PROPOSED (genuinely defective text only):

```text
- [ ] **P2-S10-AC-048** — Enforce CMS-03B-09: frozenHash/expectedVersionSet; 64 lowercase hex and strict version/hash set equal to approved candidate; 422/409. This is a contract-only publication rule until the protected operation exists.
```

DELTA:

```text
- This is a contract-only unpublish/expire/archive rule until the protected operation exists.
+ This is a contract-only publication rule until the protected operation exists.
```

WHY: OPTIONAL and cosmetic. CMS-03B-09 is the publish command: `PublicationRequest` (BE03b:560) carries no `action`, and unpublish, expire and archive reach the lineage only through CMS-03B-07 scheduling and CMS-03B-20 execution. The sentence names the wrong actions but no testable clause depends on it. Strike this item to leave the text unchanged.

EFFECT: Not needed for provability. Under A the sentence would be reworded together with the receiving criterion.

### S3-079 P2-S10-AC-079: PROVABLE NOW

Tracker/plan text today (byte-for-byte up to the source link):

```text
- [ ] **P2-S10-AC-079** — DEC-133 object structure is normalized into the immutable SchemaArtifact and definition hash so review, activation, write, restore, preview, and publication bind the same bytes.
```

Slice 10 ledger today: partial; "preview" and "publication bind the same bytes" had no runtime.

Provable on this branch: Review binds the artifact: `supabase/tests/phase_02_slice_11_rpc_review_submit.sql:72` (frozen dependency hash and activation evidence) and the manifest schema member `supabase/tests/phase_02_slice_11_helpers_manifest.sql` ("a schema artifact whose hash differs is not current"); preview binds the same bytes through the version set: `supabase/tests/phase_02_slice_11_rpc_preview_mint_refusals.sql:213-214` (schema hash member) and `phase_02_slice_11_helpers/version-set-parity.sqlinc`; publication copies them into the lineage row: `supabase/tests/phase_02_slice_11_helpers_lineage.sql:78-79` (`schema_artifact_id` and `schema_artifact_hash` equal the version set) and the `schema` preflight category (`schema_evidence_changed`) in `supabase/tests/phase_02_slice_11_helpers_preflight.sql`.

No wording change proposed. EFFECT: ledger citations only; status partial to verified. Option A: reword to review/activation/write/restore and add receiving criteria in Slice 11 (publication) and Slice 15 (exact-version preview delivery).

### S3-080 P2-S10-AC-080: PARTLY DEFECTIVE ("preview" clause)

Tracker/plan text today (byte-for-byte up to the source link):

```text
- [ ] **P2-S10-AC-080** — TypeScript and PostgreSQL validators enforce the same DEC-133 object structure and value semantics across create, append, conflict resolution, restore, draft read, preview, and publication.
```

Slice 10 ledger today: partial; "preview" and "publication" had no runtime.

Provable on this branch: Publication is provable with one small new test: the preflight `contract` category re-runs the same `platform_private.cms_draft_field_value_valid` validator that Slice 10 proved for draft read (`supabase/migrations/20261005017570_cms_preflight_evaluation.sql:383-406`), but the existing contract cases cover a number in a short_text field, relations and rich text (`supabase/tests/phase_02_slice_11_helpers_preflight.sql:335-358,669`), not the DEC-133 object structure. Needed: a stored object value that violates the DEC-133 structure fails `contract` `value_invalid` at the publish phase, in step with the TypeScript verdict over the object corpus. Preview is not provable by any validator test: CMS-03B-08 mint and CMS-03B-19 verification evaluate no field value (BE03b: "CMS-03B-08 runs no registry phase: it checks readability and version-set equality only").

PROPOSED (genuinely defective text only):

```text
- [ ] **P2-S10-AC-080** — TypeScript and PostgreSQL validators enforce the same DEC-133 object structure and value semantics across create, append, conflict resolution, restore, draft read, and publication (the preflight `contract` category in the submit, schedule and publish phases). Preview evaluates no field value; it binds the same frozen bytes (P2-S10-AC-079).
```

DELTA:

```text
- draft read, preview, and publication.
+ draft read, and publication (the preflight `contract` category in the submit, schedule and publish phases). Preview evaluates no field value; it binds the same frozen bytes (P2-S10-AC-079).
```

WHY: No Slice 11 operation validates a value at preview, so "validators enforce ... across ... preview" cannot be proven as worded. Alternative the owner may prefer: strike only the word "preview" and rely on AC-079 for preview binding. The rest of the criterion is already proven in Slice 10.

EFFECT: Publication clause needs one new test (size S, implementation already present). Under A the preview half becomes a Slice 15 receiving obligation (exact-version preview delivery renders the frozen values).

### S3-089 P2-S10-AC-089: DEFECTIVE (impossible ordering)

Tracker/plan text today (byte-for-byte up to the source link):

```text
- [ ] **P2-S10-AC-089** — CMS-03B-12 rejects malformed entry/conflict UUIDs, undeclared queries or bodies, and out-of-bound preimages before any existence or dependency work.
```

Slice 10 ledger today: partial; "needs a wording ruling: amend AC-089 so the before-any-dependency-work clause governs only addressing/queries/bodies" (EVIDENCE GAP EC R1 089-a). Not a forward-scope item.

Provable on this branch: Provable as worded: malformed UUIDs 400 and undeclared queries/bodies/mutation headers refused before any dependency work: `apps/worker/src/cms-editorial/conflict-detail-routes.test.ts:341-378` (`[P2-S10-AC-089]`). Not provable as worded: an out-of-bound preimage exists only in the dependency response, so its bound (128 paths, 256 KiB per side, BE03b:284) can only be enforced after the read, as a response-contract check (Worker 502, contract cap of 128 paths).

PROPOSED (genuinely defective text only):

```text
- [ ] **P2-S10-AC-089** — CMS-03B-12 rejects malformed entry/conflict UUIDs and undeclared queries or bodies before any existence or dependency work, and refuses an out-of-bound preimage response (more than 128 paths, or a side over 256 KiB) as a 502 `DEPENDENCY_UNAVAILABLE` response-contract failure without serving it.
```

DELTA:

```text
- CMS-03B-12 rejects malformed entry/conflict UUIDs, undeclared queries or bodies, and out-of-bound preimages before any existence or dependency work.
+ CMS-03B-12 rejects malformed entry/conflict UUIDs and undeclared queries or bodies before any existence or dependency work, and refuses an out-of-bound preimage response (more than 128 paths, or a side over 256 KiB) as a 502 `DEPENDENCY_UNAVAILABLE` response-contract failure without serving it.
```

WHY: The ledger limitation states the contradiction; the 502 status is the same ruling as S1-04 to S1-07 and S2-01 (BE03b:284 changes in lockstep). Without S2-01 this item should say "response-contract failure" with no status.

EFFECT: Wrong under both A and C. After the fix the criterion is provable from `conflict-detail-routes.test.ts:341-378` and the `[P2-S10-AC-092] ... invalid response to 502` test. Depends on S2-01 being approved or the status word being dropped.

### Option A, what it would add instead of the Section 3 citations (one paragraph)

Option A would reword the six provable criteria (038, 040, 042, 044, 046, 079) and the others in this set back to what Slice 10 itself can prove (the strict contract, the 422 at the Worker body boundary, and for 079/080 the review/activation/write/restore/draft-read half), apply the same defect fixes shown above for 030, 045, 047, 080 and 089, and move every forward clause into a new receiving criterion: roughly eight in Slice 11 (frozenHash equality and the two 409 reasons for CMS-03B-05, server-derived `riskClass`, MFA freshness and capability for CMS-03B-06, nonexistent local time and `resolvedUtc` equality for CMS-03B-07, stale version set for CMS-03B-08/09, and publication-time object validation), one in Slice 12 (block pointers once the composition write path exists), and one in Slice 15 (exact-version preview of the same bytes). That raises the Slice 11 depth floor from 122 and needs the pinned totals edited in all four places (progress script constants, the Slice 09 completion-policy test, the Slice 09 pre-traceability per-slice totals and the sha-bound Slice 09 receipts; lane-s11-0-report.md:129), while most of those clauses are already proven by Slice 11 tests that exist today. Option C needs no new criteria and instead retires these 12 of the 14 Slice 10 partials by citing tests that exist (plus one small new test for 080), at the cost that Slice 10 closure then depends on Slice 11 evidence.

## Notes found while drafting (not in the checklist unless you ask)

- N-1 Error code name. The criteria and tests name the 502 code `DEPENDENCY_UNAVAILABLE` (the shipped code and the test envelope in `workflow-read-breach.test-support.ts:28-31`). BE00:172 lists only `DEPENDENCY_UNAVAILABLE` for 502/503/504 with `retryable: true`, while the shipped 502 carries `retryable: false` (`route-error-details.ts:114-120`). This predates this batch (every verified Slice 10 route does it). If you would rather word the criteria "502" with no code, drop the code word from S1-04..S1-07, S2-01..S2-06 and S3-089; the rest is unchanged. A BE00 table row for `DEPENDENCY_UNAVAILABLE` would remove the gap.
- N-2 IA03:43 (AC-CMS-09) still says the scheduler "is not the author of the revision" for every action, contradicting DEC-164 and BE03b:195/:269. S1-02 follows BE03b. An IA03 reconciliation is out of this batch's scope.
- N-3 Records. DEC-147 (pending), DEC-170 and DEC-171 appear only in BE03b/handoffs/STATE.md and have no record in `decisions.md` or `.memory/raw/events` (last canonical id DEC-169). Ratifying this batch should flush records (agent claude, via `flushEntry`) for DEC-147 (A or C), DEC-170, DEC-171 and one batch decision, then compile, before the ledger text is frozen.
- N-4 AC-090's currency list omits the DEC-170 locale-source rule now in BE03b:1783 ("each frozen locale source is current only while its source revision still exists in that locale at the frozen hash ..."). Adding it would only strengthen the criterion; not drafted because you did not list it. Tests exist (`supabase/tests/phase_02_slice_11_recheck_locale_source.sql`).
- N-5 Same class, not requested: AC-083 says the executor "cancels with `entry_unavailable`" but DEC-158(d) and the executor block `approval_invalidated`; cancellation happens only in the invalidation transaction (review-a-ledger-refutation.md:137-148, A-M7). BE03b:1888 has the same sentence. Say if you want a drafted fix for AC-083 and BE03b:1888.

## Ratification checklist

Mark each id APPROVE or STRIKE. Dependencies: S1-04..S1-07 with S2-01..S2-06; S1-08 with S2-07..S2-10; S1-09 with S2-11; S1-10 with S2-12; S1-11 with S2-13; S3-089 with S2-01.

- [ ] S1-01  P2-S11-AC-035 reviewer separation, MFA (DEC-155)
- [ ] S1-02  P2-S11-AC-038 publisher MFA, author only for publish (DEC-155, DEC-164)
- [ ] S1-03  P2-S11-AC-041 restore truncated text (DEC-155)
- [ ] S1-04  P2-S11-AC-050 422 to 502
- [ ] S1-05  P2-S11-AC-053 422 to 502
- [ ] S1-06  P2-S11-AC-056 422 to 502
- [ ] S1-07  P2-S11-AC-059 name 502 (optional if S2-05)
- [ ] S1-08  P2-S11-AC-070 counted revoke (DEC-161)
- [ ] S1-09  P2-S11-AC-090 executor typed result
- [ ] S1-10  P2-S11-AC-097 committed lapse refusal (DEC-169)
- [ ] S1-11  P2-S11-AC-122 seven-column identity (DEC-171)
- [ ] S2-01  BE03b:284 CMS-03B-12 row 502
- [ ] S2-02  BE03b:289 CMS-03B-15 row 502
- [ ] S2-03  BE03b:291 CMS-03B-16 row 502
- [ ] S2-04  BE03b:299 all-responses row 502
- [ ] S2-05  BE03b matrix 1918, 1919 (CMS-03B-15/16)
- [ ] S2-06  BE03b matrix 1914, 1915, 1917 (CMS-03B-11/12/14)
- [ ] S2-07  BE03b:193 If-Match operands (DEC-161)
- [ ] S2-08  BE03b:1858 Assignment paragraph (DEC-161)
- [ ] S2-09  BE03b:2093 state machine (DEC-161)
- [ ] S2-10  BE03b:2184 verification wording (DEC-161)
- [ ] S2-11  BE03b:1783 executor sentence
- [ ] S2-12  BE03b:1817 aggregation exception (DEC-169)
- [ ] S2-13  BE03b:159 schedule identity (DEC-171)
- [ ] S2-14  BE03b changelog row
- [ ] S3-030  P2-S10-AC-030 defective, fix text
- [ ] S3-038  P2-S10-AC-038 provable, no text change
- [ ] S3-040  P2-S10-AC-040 provable, no text change
- [ ] S3-042  P2-S10-AC-042 provable, no text change
- [ ] S3-044  P2-S10-AC-044 provable, no text change
- [ ] S3-045  P2-S10-AC-045 defective, fix text
- [ ] S3-046  P2-S10-AC-046 provable, no text change
- [ ] S3-047  P2-S10-AC-047 defective, fix text
- [ ] S3-048  P2-S10-AC-048 provable, optional label fix
- [ ] S3-079  P2-S10-AC-079 provable, no text change
- [ ] S3-080  P2-S10-AC-080 partly defective, fix text (+1 small test)
- [ ] S3-089  P2-S10-AC-089 defective, fix text

Section 3 decision still open: A (reword to Slice 10 scope plus receiving criteria) or C (keep wording, prove with the Slice 11 runtime, fix only the defective text above). The defective-text items S3-030, S3-045, S3-047, S3-080, S3-089 apply under either choice; S3-048 is optional; the six "provable" items need no text under C.
