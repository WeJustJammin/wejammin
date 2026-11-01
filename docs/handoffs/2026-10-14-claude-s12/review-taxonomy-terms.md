# Independent review: lane `claude_s12_taxonomy_terms_sql` (taxonomy-terms)

Reviewer: independent, read-only, static only (no DB, no runner). Target: author report
`lane-taxonomy-terms-report.md` (SHA-256 `c37544038da78c6ffcf643172a2e10025bf0df42934209d0142f19ab8caabdac`, re-hashed and
matching), twelve WIP migrations `supabase/migrations-wip/taxonomy-terms/20261014120000..120710`, suites
`phase_02_slice_12_taxonomy_terms{,_reads,_canonical}.sql` and both fragment dirs, the TC1 witness copy, final TAP
`.lane-logs/alt-staged-taxonomy-terms-213400-2541038.tap` (SHA-256 `13326c32...`), RED TAP `alt-staged-governed-b-171816-1555382.tap`
(SHA-256 `505f9169...`). Spec read: BE03c 161, 166-167, 179, 187, 379-381, 406, 408-410, 1290-1304, 1334-1357, 1369-1377, 1428-1430,
1447, 1464-1481, 1506, 1539, 1554-1561, 1608-1627; contracts `taxonomy-term.ts`, `taxonomy-term-list.ts`, `taxonomy-selector.ts`,
`canonical-taxonomy-match.ts`; precedents `20261014030200/030300/030400`, `20261013300790`, `20261013300100`, `20260927260000`,
`20260927380000-410000`, `20261005010400`, `20261014070510/070610`. Every file was read in full.

## 1. Spec conformance (route clause -> implemented -> tested)

| Clause (BE03c) | Implemented | Tested |
| --- | --- | --- |
| 161 curator only; 403 `capability_missing` / 404 concealment; order 401->404->403 | 120500:52-71 (concealment before capability, capability re-proved under position-1 lock 120500:68) | terms/050:6-34, 095:45-47 |
| 161 key + If-Match = ACTIVE TaxonomyVersion `version` (BE03c 215); 409 on mismatch | 120200:36-41, 120500:95-104 | 050:37-43, 095:43-44, 040 version-* cases |
| 379 no active version -> 409 `taxonomy_not_active` | 120500:95-101 | 050:30-33 |
| 379 `parentId` non-null needs `hierarchical` | 120400:46-49 | 060:6-14 |
| 380-381 key grammar, 1-64 NFC labels, survivor/parent not self/cyclic/merged | 120200:43-102; 120400:66-91, 144-155 | 040 (110 table cases), 060:33-53, 080:91-109 |
| 408-410 exact members, 8-128 ASCII key, non-object body | 120200:29-31, cms_reserve, 120500:52-54 | 040:9-33, 105-110 |
| 1344 lock positions 1, 3, 6 (id order) | 120500:68 (1), 95-98 FOR SHARE (3), 107-118 ascending id FOR UPDATE (6) | static only; no concurrency run (forbidden to lane) |
| 1375 overlap on create/rename/alias over declared domains, never on merge/deprecate; `canonical_overlap` {domain, canonicalId}; `canonical_source_unavailable` {domain} | 120400:51-64, 120200:106-151 | 090:14-36, 46-70; 099:16-31 |
| 1377 create/rename/alias/deprecate semantics; labels append-only; alias union <=64 | 120400:93-121, 120200:178-227 | 030, 070:9-90 |
| 1377 merge: survivor active or deprecated, retired not merged, FOR UPDATE id order, `successor_id`, convergence <=5,000 then job | 120400:125-166, 120300:21-90 | 080:23-130 (small sets), 085 (batch 2, handler) - see M2 |
| 1377/1539 merged never reactivates; deprecated->merged only | 120050:104-139 | 080:74-84, 095:65-73 |
| 1371/1428 `cms_terms.taxonomy_id` NOT NULL, UNIQUE(taxonomy_id, term_key, version), stable keys across versions | 120000:23-85 | 095:5-61, 74-88 |
| 1554-1561 one `cms.taxonomy.changed.v1` per action, aggregate `cms_term`/termId/term version, payload {taxonomyId, taxonomyVersionId} | 120500:126-133 | 030:41-50, 070:30-38, 080:58-64, 095:91-93 |
| 1506 audit + event + completed reservation atomic; replay returns stored resource; mismatch 409 | 120500:76-82, 134-136 | 030:56-72, 050:45-74 |
| 167/406 terms read: curator; witness `{taxonomyId, page}`; (termKey ASC, termId ASC) bytewise; 25/50; lifecycle filter; cursor bound to query + acting scope; 400 malformed / 409 foreign-expired-tampered (DEC-140) | 120600:69-71, 88-93, 95-123, 125-148; 120610 | reads/020, 030, 040 |
| 179/373 selector: author or editor; active vocabularies allowlisting type+field; active terms only; label exact locale, null without fallback; (taxonomyKey, termKey); 50/100 | 120700:66-69, 122-145; 120710 | reads/050, 060 |
| 187 CMS-03C-18: one domain, 1-64 candidates, NFKC/lower/trim/collapse, exact equality, `source_unavailable` for unbuilt, provider fault or >2,000 ms -> DEPENDENCY_UNAVAILABLE, no API role, read-only | 120100:57-127, 132-142 | canonical.sql:99-241 |
| 1447 grants: service_role on the three `platform_api` wrappers only; everything private revoked | 120510:37-38, 120610:63-65, 120710:60-62, every private file | 020-surface, reads/020:4-18, 050:5-18, canonical:110-125 |
| 1334/1351/1447 job `cms.taxonomy.merge_converge` as a BE00 jobs row with a handler the Worker can run | 120000:130 (registry), 120300:95-166 (request + handler) - NOT reachable, see M1 | 085:52-81 (handler called directly with the RLS flag set by the test helper) |

Contracts: every response is built member-for-member against the frozen schemas (030:8-10, reads/020:30-37, 050:23-25 pin the exact
key sets). No `any`, no TODO, no boundary stub in lane files; all files <=300 lines (largest 245); fragments <=239 lines.

## 2. Security

authN/authZ ordering matches the taxonomy-def precedent (030200) exactly; concealment is by acting party; a non-lineage id, a foreign
lineage and an absent id give one refusal (050:19-34, reads/040:8-17). No PII or provider error text in any message (120100:107-108 swallows
the provider error; tested canonical:201-205). Replays are per actor and re-prove the capability first (050:45-74). Cursors are HMAC
sealed by the promoted helpers, bound to actorId + actingPartyId + every query member (120600:95-97, 120700:93-95), expiry capped
by the opener. The role provider reads `role_facet_assertion` through a column-scoped grant and a state='active' policy (120100:133-135).
No fail-open path found. Labelled fixture forgeries (membership tenures, second-org grant, facet assertions, entry/revision rows,
assignment rows) are confined to 000-world/010-setup and are not used to bypass any producer under test.

## 3. TC1 (`populated-lineage.sql`, two hunks)

Correct and non-weakening. The dropped constraint is only the lane's new three-column `cms_terms_version_lineage_fkey`; the original
two-column `cms_terms_taxonomy_owner_fkey` (20260927260000:54-56) stays, so the tail assertion "a term keeps its version-row foreign
key" (populated-lineage.sql:262-264) still has an FK behind it. The legacy insert names its own lineage (version-1 row id), which the
new NOT NULL and the (taxonomy_version_id, taxonomy_id, owner_id) shape accept; `cms_terms_00_lineage_fill` does not take its SELECT
branch, so the reverted column is never referenced. The replayed DDL is still 030000's block, so the witness still witnesses 030000.
Diff of the witness copy against the promoted file is exactly the `\ir` paths plus these two hunks (verified by `diff`).

## 4. Findings

- `supabase/migrations-wip/taxonomy-terms/20261014120300_cms_taxonomy_merge_convergence.sql:119-181` and
  `20261014120000:130`; report `## RPC boundary` — **major** — The spec-mandated continuation (BE03c 1377, 1334, 1447) has no
  transport: `cms_run_taxonomy_merge_converge` has EXECUTE revoked from service_role, has no `platform_api` wrapper (the CMS-03C-19
  precedent ships `platform_api.cms_claim_due_governed_activations`/`cms_execute_governed_activation`, 20261014070510/070610), is absent
  from the RPC boundary, and never sets `app.cms_rpc` (the forced-RLS term tables answer no rows without it, so a caller that did reach
  it would get a silent `{converged:0, remaining:0}`). `020-surface.sqlinc:34-36` asserts the absence of a transport as a property.
  A merge with >5,000 assignments therefore commits a queued job no principal can execute and an unconverged tail forever. Fix: add
  `platform_api.cms_run_taxonomy_merge_converge(p_request jsonb)` (definer-owned, service_role EXECUTE, sets/restores the flag,
  deadlock -> CONFLICT), make the private handler set the flag itself, document it in the RPC boundary with the claim/outcome
  contract, invert the 020-surface assertion, and test through the wrapper, not through a helper that pre-sets the flag.
- `20261014120400_cms_term_action_apply.sql:160-163`; `085-continuation.sqlinc:5` — **major** — The only production branch that
  enqueues the job (`remaining > 0`) is executed by no test; the batch function and handler are exercised with batch 2 on three rows.
  The justification "5,001 assignment rows are not seedable here" is unsupported (set-based `generate_series` seeding of 5,001
  revisions and assignments through `s12tt_seed_revision`/`s12tt_assignment` is feasible), and the "report's BOUNDARY list" it points
  to does not exist in the report. Tracker 1613 names "merge convergence of up to 5,000 assignments in one transaction and the
  resumable job beyond it" as a required test. Fix: seed >=5,001 active assignments, prove one merge converges exactly 5,000, writes one
  `cms.taxonomy.changed.v1` plus one queued job, and the handler converges the remainder idempotently.
- `20261014120300:40,47` — **minor** — The job path locks the retired term then the survivor, not in ascending id (BE03c 1338); a
  concurrent command naming both rows locks them in id order, so the pair can deadlock (the command maps it to CONFLICT, the job
  aborts and retries). The command path is unaffected (rows already held from 120500:107-118). Fix: lock both ids in one
  `where id in (retired, successor) order by id for update` after an unlocked read of `successor_id`, then re-verify.
- `20261014120300:119-166` — **minor** — The handler takes position 6 only; BE03c 1351 names positions 1, 3 and 6 for
  `cms.taxonomy.merge_converge`, and 1334 says its durable cursor is job state; the handler derives work from the data and never
  touches `jobs.progress`. Functionally idempotent; record the deviation or take positions 1 and 3 and write the cursor.
- `20261014120200:81-85`, `20261014120600:134-136`, `20261014120700:129-133` — **minor** — Locale case: the validator dedupes
  locales case-insensitively per request but stores them as submitted, and the reads/selector match `locale` exactly;
  `CmsLocaleSchema` is a case-insensitive grammar with no canonical form, so `en-US` and `en-us` become two label lineages and the
  selector misses a case variant. Fix: canonicalize (BCP 47 case folding) at write and at read.
- `20261014120000:28-57` — **minor** — The backfill runs on a populated table with no populated witness (030000 has one); during the
  UPDATE the old successor and hierarchy guards (20260927410000:13-30, 390000:31-52) still fire for merged and parented rows, and the
  old successor guard refuses a merged row whose survivor was later deprecated with P0001, not the claimed SQLSTATE 55000 (R5).
  Reachable only by hand-written rows (no producer existed), so low risk; either disable those two guards around the backfill as the
  lifecycle guard is, or add a witness and state N/N rows.
- `20261014120500:7`, report `## RPC boundary` and D1 — **minor** — "the nine TaxonomyTermActionRequest members": the contract has
  eight; "BE03c 1380 If-Match operands": the clause is at BE03c 215. Citation hygiene only.
- RED TAP lines 39, 76, 116-122 — **minor** — The terms and reads RED is a harness abort (`000-world.sqlinc:47` references the
  not-yet-existing column inside a SQL function body, "No plan found"), not assertion-level RED; only the canonical suite produced
  `not ok` 3-11 before aborting at its line 136. The report classifies all three as "genuine missing feature"; lane rules require the
  harness-abort class to be named.
- `20261014120600:73-86` — **minor** — `/limit` and `/lifecycle` faults raise VALIDATION_FAILED (422) while the validation row for
  cmsTaxonomyTermsRead (BE03c 406) lists only 400/404/502 (catalog 1295 does list 422; the CMS-03C-17 row 373 says 400/422). Spec is
  inconsistent; the Worker's Zod parse decides the status. Note for the Worker lane, not a SQL defect.
- `20261014120200:50-57` (D3) — **minor** — A non-null `parentId` on alias/deprecate/merge is 422, narrowing the frozen contract
  (which allows it on every action); FE03 1792 does not say what `CmsTaxonomyTermForm` sends for `parentId` on those actions. Root
  should confirm with the FE/Worker lane before promotion or the form's deprecate of a child term will be refused.
- `20261014120100:25-37` — **minor** — `cms_name_uuid` stamps version nibble 5 on an MD5-derived value (RFC 4122 v5 is SHA-1; MD5 is
  v3). Cosmetic; the contract's `z.uuid()` accepts it.
- `phase_02_slice_12_taxonomy_terms_canonical.sql:114-116` — **minor** — The DEC-100 oracle (`prosrc !~ 'role_facet_assertion'` on the
  matcher only) is satisfied by one level of indirection; the provider projection itself (120100:42-52) reads the Shard 01 table under
  a new policy on that table. No Shard 02 projection exists in `supabase/migrations/` (only `identity_facet_add/remove`), so the design
  is defensible, but the new cross-shard policy and grant are a surface root must ratify (R3 covers the pin, not the decision).

## 5. Author claims re-verified (static)

All sixteen listed SHA-256 values match the files on disk. Final TAP: plans 294/169/54 (own suites) with zero `not ok` inside them;
the seven `not ok`s are S09 pins 448, 538, sec2_all 6, r8 4/13/14, trigger_catalog 44 as the report attributes. Witness TAP
`213555-2553797`: 37 + 54, zero `not ok`. `contentHash` digest matches the promoted manifest digest (20261005017560:249). R1 trigger
inventory +1 with tgtype 7 is correct; R2 three RPCs and R3 two tables are correct against the pinned lists.

## 6. Verdict

Command, reads, matcher, storage re-key, guards and TC1 are spec-conformant and strongly tested. The merge continuation is delivered
as a function nobody can call and its enqueue branch is untested; that half of BE03c 1377 is not done. Promote the twelve migrations
and TC1 only with M1 and M2 fixed in this lane's range, and do not mark P2-S12-AC-021 or the convergence clause of AC-003 complete
until then.

VERDICT: PARTIAL
