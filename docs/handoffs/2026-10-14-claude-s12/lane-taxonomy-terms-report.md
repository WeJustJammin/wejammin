# Lane taxonomy-terms: CMS-03C-03 / -17 / -18 and cmsTaxonomyTermsRead SQL

Lane `claude_s12_taxonomy_terms_sql` (staged-runner lane `taxonomy-terms`, staged as `governed-b,taxonomy-terms`), 2026-10-14.
Worktree `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`, branch `claude/phase2-slice12`, HEAD
`b16edb54a7a1b698ed8ca15b6085046d4270626e` (verified at start).

## Status

GREEN for the lane's own scope. All three own suites plus link_integrity, taxonomy_authority and taxonomy_definition pass on lane `taxonomy-terms`
alone (run 4: 294 + 169 + 54 + 26 + 25 + 1334 tests, 0 failures). Residual failures in the Slice 09 catalog-pin suites and one populated-witness
incompatibility are root-owned pin/test updates, listed exactly under `## Requests to root`.

## Scope

Brief `docs/handoffs/2026-10-14-claude-s12/briefs/taxonomy-terms.md`. WIP migrations in
`supabase/migrations-wip/taxonomy-terms/` (20261014120000..20261014129999); suites
`supabase/tests/phase_02_slice_12_taxonomy_terms{,_reads,_canonical}.sql` and their directories.

## Design decisions (implementation tier, stated so root can override)

- D1 `expectedVersion`/`If-Match` of CMS-03C-03 is the vocabulary's ACTIVE TaxonomyVersion definition `version` (BE03c 1380
  "If-Match operands"; Worker contract comment `taxonomy-term.ts`). A mismatch is 409 CONFLICT; term concurrency is by the
  position-6 row locks (BE03c 1344).
- D2 A term is addressed by `(taxonomyId, termKey)`; `create` needs the key to be new (409 otherwise), every other action needs it
  to exist (404). A merged term refuses every action (409).
- D3 `parentId` is applied on `create` and `rename` (the term's parent after the action; null = root); on alias, deprecate and merge
  it must be null (422 at /parentId).
- D4 `labels` and `aliases` are required by the contract for every action but applied only by create (both), rename (labels) and
  alias (aliases); deprecate and merge validate then ignore them (BE03c 1375: "no new string").
- D5 Survivor of a merge may be `active` or `deprecated` (BE03c 1377). The stored successor guard (20260927400000/410000) accepts
  only `active`; this lane replaces it forward-only. Merging a term that already has inbound redirects, or has children, stays
  refused (the stored invariant, tracker line 461).
- D6 `cms_terms` is re-keyed to the vocabulary lineage: `taxonomy_id`, same-named `(taxonomy_id, term_key, version)` and
  `(taxonomy_id, term_key)` uniques, lineage-based parent/successor FKs (same names). `taxonomy_version_id` stays the version in
  force when the row was written, so the assignment FK is untouched.
- D7 Assignment convergence: an assignment lineage is `(revision_id, field_definition_id, term_id)`; the current row is the highest
  version; a merge appends a `superseded` row for the retired term and an `active` row for the survivor (skipped when the survivor
  is already active there). Up to 5,000 per transaction; the rest through the registered job `cms.taxonomy.merge_converge`, whose
  handler derives its work from the merged terms (the jobs table has no payload column).
- D8 Provider for domain `role` (registry `shard02.role_facet_assertion`): a read-only view over active
  `role_facet_assertion.facet_code`; `canonicalId` is a deterministic name-based UUID of the code, `canonicalKind` `role_facet`.
  The 2,000 ms deadline is measured around the provider read (PL/pgSQL cannot interrupt a nested statement).

## Files

WIP migrations (`supabase/migrations-wip/taxonomy-terms/`): 120000 term lineage columns and re-keyed constraints, 120050 stored guards (lineage,
advisory serialization, deprecated survivor, term state machine), 120100 CMS-03C-18 matcher and role provider, 120200 CMS-03C-03 support,
120300 merge convergence and the continuation job, 120400 apply steps, 120500/120510 `cms_act_taxonomy_term` and its transport, 120600/120610
`cmsTaxonomyTermsRead`, 120700/120710 CMS-03C-17.  Suites: `phase_02_slice_12_taxonomy_terms.sql` (+ dir, 13 fragments),
`phase_02_slice_12_taxonomy_terms_reads.sql` (+ dir, 7 fragments), `phase_02_slice_12_taxonomy_terms_canonical.sql`, plus the verification copy `phase_02_slice_12_taxonomy_terms_populated_witness.sql` (TC1).

Frozen files (path, sha256):
- `supabase/migrations-wip/taxonomy-terms/20261014120000_cms_terms_lineage_columns.sql` 2c1d986cc8b80aa4e548229c91b2170ebcab7a26094609046bdc6a918614ccb6
- `supabase/migrations-wip/taxonomy-terms/20261014120050_cms_terms_guards_lineage.sql` 5b92b62b233e4629e7487158befab229377f269205db39c08d359b11ab0b4a45
- `supabase/migrations-wip/taxonomy-terms/20261014120100_cms_canonical_taxonomy_match.sql` 3e2bd3463c3e73cb82b2aa03137fa40cf78c529a6180e9c92815b67563ee79b9
- `supabase/migrations-wip/taxonomy-terms/20261014120200_cms_term_action_support.sql` a2cc16561154544b8a201faef7f66eedfafa597a90545427a77061c18beefebd
- `supabase/migrations-wip/taxonomy-terms/20261014120300_cms_taxonomy_merge_convergence.sql` 41af1e0e0055fd5268f25f4f3507b0898a757c3291cf8cae086817cb4c25532a
- `supabase/migrations-wip/taxonomy-terms/20261014120400_cms_term_action_apply.sql` 11a1aa5e87b360bb12101393a2ba6e7d60b9811bf79733556cbf0c6587c5976c
- `supabase/migrations-wip/taxonomy-terms/20261014120500_cms_act_taxonomy_term.sql` 2a38973ccb0f3bef85836989febe541d5b1f2fd42b68669d8b0dd6cf7fff75af
- `supabase/migrations-wip/taxonomy-terms/20261014120510_cms_act_taxonomy_term_public.sql` 81d35514aabc9135f84ab49c6626c9e118f2e483a0299b2b65461deff988ed31
- `supabase/migrations-wip/taxonomy-terms/20261014120600_cms_list_taxonomy_terms.sql` 6b338d741d670cc704f5770f86e2a07911226444d98b1ddd0f85ca3e3a459dc7
- `supabase/migrations-wip/taxonomy-terms/20261014120610_cms_list_taxonomy_terms_public.sql` dc9b949f02c4a5984a418d487c94addb1a40dfcabb155ca1dc130abfbc10ef61
- `supabase/migrations-wip/taxonomy-terms/20261014120700_cms_list_taxonomy_selector.sql` 30808804c32b449f09a7770072456a51d47a98527b0adc58194a4b2bece6d5ab
- `supabase/migrations-wip/taxonomy-terms/20261014120710_cms_list_taxonomy_selector_public.sql` 91f68d6983c086e9e597222aeb815f2c7add8025dd8addb6563bf5b3efc35fb2
- `supabase/tests/phase_02_slice_12_taxonomy_terms_canonical.sql` 7f845afbd6b9a1ad94bb1d652ef1fdb579024c9a6647b63844aa08e421f2b833
- `supabase/tests/phase_02_slice_12_taxonomy_terms_populated_witness.sql` 1b6953f4ba9f9a14f30fff4c19153a47d5c0b7188d4b8d41bf7d94d545cdbea8
- `supabase/tests/phase_02_slice_12_taxonomy_terms_reads.sql` 5782347622b8d5d65c64ef3b3d95f6bb0afeee5bc3687a7027a5f5bd4b97083d
- `supabase/tests/phase_02_slice_12_taxonomy_terms.sql` d3c53f58d41e6aa93c08f75a42bbe9685b587d0c0fe34bc3cc2e6b46ad7290c9


## Runs (recovered from `.lane-logs/`, predecessor + this session)

| # | Stamp | Lane / plan | Result | Notes |
|---|-------|-------------|--------|-------|
| 1 | 171930-1564019 | governed-b,taxonomy-terms; terms, reads, canonical, link_integrity, authority (562) | FAIL 561/1 plus parse error | HARNESS: canonical suite line 205 `$` syntax error (nested `$$`); not feature RED |
| 2 | 172121-1576796 | same 5 files (568) | PASS 568/568 (plan 25 on last file) | after the `$q$` quoting fix landed in the canonical suite. TAP sha256 720d4fab... |
| 3 | 172241-1585502 | governed-b,taxonomy-terms; 11 regression files (2,375) | FAIL 5 not ok + populated-lineage abort | slice09 #76 (version CHECK), sec2_all #3 (cms_canonical_role_facets owner=postgres; fixed afterwards in 120100 by `alter function ... owner to wejammin_cms_definer`), #6/#448 (catalog pins, also failing on governed-b alone), #449 (a proved trigger absent), `taxonomy_definition/populated-lineage.sql` dies: `cannot drop column taxonomy_id ... cms_terms_version_lineage_fkey depends on it` |
| RED | 171816-1555382 | governed-b only; terms, reads, canonical | FAIL (genuine missing feature) | CMS-03C-18 function and wrappers absent; suites abort at the surface checks. TAP sha256 505f9169... |
| 4 | 213400-2541038 | taxonomy-terms alone; 12 files (2,706) | own 3 suites + link_integrity + authority + definition + p240 + sec2_all(#1-5) ALL PASS; FAIL only slice09 pins (below) and one deadlock | TAP sha256 13326c32... Own plans: terms 294, reads 169, canonical 54, link_integrity 26, authority 25, definition 1334, p240 96 |
| 5 | 213555-2553797 | taxonomy-terms alone; populated witness copy + sec2_definer_rls (91) | PASS 91/91 | the deadlock in run 4 (`sec2_definer_rls` line 490, two foreign sessions on cms_content_types) did not recur on a clean rerun with different file set: environmental, not feature. TAP sha256 4d73a2a1... |
| 6 | 213714-2563622 | `none` (promoted only); slice09 schema, sec2_all, r8, trigger_catalog (659) | FAIL 4 (sec2_all #6, r8 #4/#13/#14) | baseline WITHOUT this lane: attributes those four to other promoted lanes. TAP sha256 75066ef8... |

Attribution of run 4's non-green slice09 results (run 6 is the baseline):
- baseline-also-failing (not this lane): sec2_all #6 governed-b tables, r8 #4/#13/#14 governed-b/taxonomy-def RPCs. `schema` #448/#538 and
  `evidence_trigger_catalog` #44 in run 4 were the then-unlisted governed tables; the pin files changed on disk (root) after run 4 and run 6 passes them.
- this lane's exact deltas on those pins: see Requests to root R1-R3.

## Test corrections

TC1 (needs root to apply; verified on a copy). `supabase/tests/phase_02_slice_12_taxonomy_definition/populated-lineage.sql` (taxonomy-def lane,
promoted) reverts `cms_taxonomy_versions` to its pre-migration shape by dropping `taxonomy_id`. BE03c 1371 requires `cms_terms.taxonomy_id`
(NOT NULL) and a foreign key pinning a term's write-version to its own lineage, so the revert now fails (`cannot drop column taxonomy_id of table
cms_taxonomy_versions because other objects depend on it`: `cms_terms_version_lineage_fkey`, run 3) and its legacy term insert would lack the new
column. The test does not contradict the spec; it simulates an older shape that the spec change forces to include the dependents. Minimal diff
(two hunks):
```
@@ step 2, before `alter table platform_private.cms_taxonomy_versions disable trigger cms_taxonomy_versions_lifecycle_guard;`
+alter table platform_private.cms_terms drop constraint cms_terms_version_lineage_fkey;
@@ the legacy term insert
-insert into platform_private.cms_terms(id, owner_id, version, taxonomy_version_id, term_key, created_by)
-select 'a9126000-0000-4000-8000-00000000e001', owner_id, 1, id, 'wit-term', created_by
+insert into platform_private.cms_terms(id, owner_id, version, taxonomy_version_id, taxonomy_id, term_key, created_by)
+select 'a9126000-0000-4000-8000-00000000e001', owner_id, 1, id, id, 'wit-term', created_by
```
(`id` is its own lineage because the term sits under version 1.) Verified: the corrected copy
`supabase/tests/phase_02_slice_12_taxonomy_terms_populated_witness.sql` (only the `\ir` paths and these two hunks differ) passes 15/15 plus
all following assertions on lane `taxonomy-terms` (run 5). Root: apply the hunks to `populated-lineage.sql`, then delete the witness copy.

## Spec citations

BE03c 161 (CMS-03C-03 row), 166-167 (reads), 179 (CMS-03C-17), 187 (CMS-03C-18), 366-410 (validation matrix), 1344 (lock order),
1369-1377 (D10, DEC-135, term actions), 1428-1429 (term/label rows), 1478-1480 (authorization), 1506 (transaction seam),
1539 (term state machine), 1554-1561 (event and outbox identity).

## RPC boundary (for the Worker lane; no Worker file was edited)

All four are `SECURITY DEFINER`, owner `wejammin_cms_definer`, `search_path=''`, errors are `P0001` whose message is a token (a catalog class, or a
lowercase typed reason such as `capability_missing`, `taxonomy_not_active`, `canonical_overlap`, `canonical_source_unavailable`), DETAIL carries
`["/pointer"]` or `{ "domain": ... }` where specified. Reads lock and write nothing; the act command commits audit + one
`cms.taxonomy.changed.v1` + the completed idempotency reservation atomically with the change.
- `platform_api.cms_act_taxonomy_term(p_request jsonb) returns jsonb` (service_role only) -> `platform_private.cms_act_taxonomy_term`. Request =
  the nine `TaxonomyTermActionRequest` members + decoded `ifMatch` (decimal string equal to `expectedVersion`) + `idempotencyKey` + server
  `context` + `correlationId`. Deadlock/lock timeout maps to `CONFLICT`. `expectedVersion`/`If-Match` = ACTIVE TaxonomyVersion definition `version`.
- `platform_api.cms_list_taxonomy_terms(p_request jsonb)` (service_role only): `{ taxonomyId, lifecycle?, cursor?, limit?, context,
  correlationId? }` -> witness `{ taxonomyId, page: { items, nextCursor, pageVersion } }`; signed cursor domain `cms-03c-terms`; limit 1..50
  default 25; order (termKey bytewise ASC, termId ASC).
- `platform_api.cms_list_taxonomy_selector(p_request jsonb)` (service_role only): `{ typeKey, fieldKey, locale, cursor?, limit?, context,
  correlationId? }` -> the strict `TaxonomySelectorPage` itself; signed cursor domain `cms-03c-17`; limit 1..100 default 50; order
  (taxonomyKey, termKey) bytewise; needs `cms.author` or `cms.editor`.
- `platform_private.cms_canonical_taxonomy_match(p_domain text, p_candidates jsonb) returns jsonb` (no API role; definer callers only):
  `{outcome:'no_match'}` | `{outcome:'match',domain,canonicalId,canonicalKind}` | `{outcome:'source_unavailable',domain}` (caller refuses
  `canonical_source_unavailable`); provider fault or >2,000 ms is `DEPENDENCY_UNAVAILABLE` (503).

## Open items / BOUNDARY

- Design decisions D1-D8 above stand; D8's canonical provider exists only for domain `role`. Other domains are `unbuilt` in the registry and
  answer `source_unavailable`; no BOUNDARY stubs were needed.
- `cms_terms_00_lineage_fill` is a convenience BEFORE INSERT trigger (fills an omitted `taxonomy_id` from the version row). It is why existing
  fixtures that name only the version keep working; it also adds one trigger to the Slice 09 inventory (R1).
- The 2,000 ms deadline is measured around the provider read (PL/pgSQL cannot interrupt a running nested statement); recorded in the 120100 header.
- Not run by this lane (forbidden): canonical gates, race modules, `db:types` (the new RPCs change generated types), Worker/web tests.

## Requests to root

R1 trigger inventory (`supabase/tests/phase_02_slice_09_dec108/06-trigger-probes.sqlinc`, count test 134 -> +1): add
   `('cms_terms', 'cms_terms_00_lineage_fill', 'cms_terms_lineage_fill', 7)` (BEFORE INSERT row). Fixes schema #448.
R2 API surface (`phase_02_slice_09_r8_api_surface.sql`): classify and enumerate three more API-executable RPCs `cms_act_taxonomy_term`,
   `cms_list_taxonomy_terms`, `cms_list_taxonomy_selector` (service_role only; the executable total rises by 3 beyond the promoted lanes).
R3 forced-table pin (`phase_02_slice_09_sec2_all_schema_definer_rls.sql` #6): add `platform_private.cms_term_labels` (written by the
   term producers as the CMS definer) and `platform_private.role_facet_assertion` (read by `cms_canonical_role_facets` through one
   column-scoped grant (facet_code, state) and one SELECT policy admitting only `state='active'`, DEC-100 named projection). Also review that
   the definer role now has: SELECT/INSERT/UPDATE on cms_terms, SELECT/INSERT on cms_term_labels and cms_term_assignments.
R4 apply TC1 to `populated-lineage.sql` and delete `phase_02_slice_12_taxonomy_terms_populated_witness.sql`.
R5 promote `supabase/migrations-wip/taxonomy-terms/*` (12 files, 20261014120000..120710, order is the filename order; 120000 backfills
   `cms_terms.taxonomy_id` on populated data and refuses SQLSTATE 55000 on an unplaceable row), then run `db:types`.
R6 `sec2_definer_rls` once deadlocked in run 4 with a foreign session; if it recurs in canonical gates, it is the quiet-host issue
   (`gates-need-quiet-host`), not this lane.

## Fix pass

2026-10-14, HEAD b16edb54 verified at start. Brief `briefs/taxonomy-terms-f1.md`, review `review-taxonomy-terms.md` (was PARTIAL).
**Status: GREEN.** Final run 4 (stamp 222923-2842524, lane `governed-b,taxonomy-terms`): 8 files, 2,026 tests, 0 failures (terms 337, reads 170, canonical 62,
new populated witness 35, TC1 witness copy 37, taxonomy_definition 1,334, link_integrity 26, authority 25). TAP SHA-256
`64e35d2fb135bf6565c058b6eb5e148475d2c27081061812f8bda9a76c9ec72d` (`.lane-logs/alt-staged-governed-b+taxonomy-terms-222923-2842524.tap`).
`pnpm exec vitest run tests/contracts/phase-02-slice-12-taxonomy-terms-witness-parity.test.ts` (and the taxonomy lineage parity test): 6/6.

### Runs

| # | Stamp | Plan | Result | Class |
|---|-------|------|--------|-------|
| F-RED | 220612-2717789 | terms, reads, canonical, new witness (579) | 35 `not ok` + one abort at `097:48` | feature RED (transport absent 25-27/29/254-266, parent on alias/deprecate/merge 190-192, reads limit/lifecycle 61-76, selector locale 107, v5 UUID 23-25) plus THREE TEST DEFECTS of mine, fixed in the tests only: `is(bigint, integer)` harness abort at 097:48, a wrong event oracle (#312 counted the create event too), a DEC-100 oracle (#8/#9) that tripped on the registry key literal `shard02.role_facet_assertion` |
| F-1 | 220925-2737979 | the same plus definition/link/authority | RESET FAILED | harness: `pg_catalog.substring(.. from ..)` is not valid call syntax in my new `cms_name_uuid` (120100); fixed to `pg_catalog.substr` |
| F-2 | 221232-2757038 | 8 files (2,026) | 1 `not ok` (#314) | test defect: the audit delta counted a second audit row of another action; the claim is "one cms.taxonomy.term.merge record", now asserted by action and target |
| F-3 | 222923-2842524 | 8 files (2,026) | PASS | TAP `64e35d2f...` |

The witness (`populated-terms-lineage.sql`) replays the DDL region of the migration, so it was written after the migration region and could not be
RED against the older text; its RED is the parity test (3 failures before the witness existed and before the region carried the new check) and its
first run was green. The original review also asked that the harness-abort class of the first-pass RED be named: the terms and reads RED of the first pass was a harness abort
(`000-world.sqlinc:47` references the not-yet-existing column inside a function body, "No plan found"), not assertion-level RED; only the canonical suite was assertion-level. This pass's RED was assertion-level for every feature item.

### Review findings, one by one

M1 (transport). `platform_api.cms_run_taxonomy_merge_converge(p_request jsonb)` (new `120310`) mirrors 070510/070610: SECURITY DEFINER, definer-owned,
`search_path=''`, EXECUTE to `service_role` only, deadlock/lock failure -> `CONFLICT`, request `{ jobId, batch? }` (exact keys, batch 1..5000 default 5000)
-> `{ converged, remaining }`. The private handler now sets `app.cms_rpc` itself; the wrapper restores the caller's value. `020-surface` asserts the
transport exists with exactly that ACL and that the batch function and the request stay internal (the old absence assertion is gone). `085` drives the
handler ONLY through the wrapper under the real `service_role` with the context cleared first (`s12tt_run`), including 11 malformed request shapes, unknown
job, other-type job, flag restoration (`''` before and after), idempotent re-delivery, a budget of 2 over 3 assignments (2 left 1, then 1, then 0), and that the job row is not written.
M2 (enqueue branch). `097-bulk-continuation`: 5,001 REAL assignments (set-based `s12tt_seed_bulk`, same labelled forgery class as `s12tt_assignment`),
the REAL `cms_act_taxonomy_term` merge: exactly 5,000 survivor rows + 5,000 superseded, 1 unconverged, exactly one queued BE00 job bound to actor and party,
exactly one `cms.taxonomy.changed.v1` (version 2) and one audit record, then the transport converges the last one, no duplicate (revision, field) survivor row,
re-delivery 0/0. No test-only batch size exists; production uses 5000.
m1 lock order. `cms_converge_taxonomy_merge` reads the (immutable) redirect target unlocked, then locks retired + survivor in ONE
`where locked.id in (...) order by locked.id for update` (BE03c 1338), re-reads under the lock. Pinned in `085`.
m2 positions. The handler takes position 1 (`cms_lock_governed_authority`, FOR SHARE, capability NOT re-proved: the merge it continues is committed), position 3
(ACTIVE version row of every vocabulary with work, FOR SHARE, ascending id), position 6 (every retired term with work and its survivor, FOR UPDATE, ascending id, one
statement) (BE03c 1351). New shared predicate `cms_taxonomy_merge_work(owner, term)` replaces four copies of the "current active row" subquery.
**D9 (decision, root may override): the cursor is the data, not a jobs column.** The definer holds SELECT only on `platform_private.jobs` (20261003120100) and the BE00
runtime owns lease/version/outcome; writing `jobs.progress` needs a new UPDATE grant plus a policy on a pinned forced-RLS table and has no spec'd writer. The job-state
contract the Worker already implements (`async-runtime-job-delivery.ts`, `JobEffectResult`) is: `remaining > 0` -> `{ state: 'queued', errorCode: null }` (healthy
progress continuation, retries at once), `remaining = 0` -> `succeeded` with `resultRef = { converged, remaining: 0 }`. See BOUNDARY below.
m3 locale. New `platform_private.cms_term_locale_canonical(text)` (IMMUTABLE; BCP 47 case: language lower, 4-letter script Title, 2-letter / 3-digit region UPPER,
singleton and private-use lower). Writes dedupe AND store the canonical form (a rename in another case appends to the same label lineage); the selector matches the requested
locale in canonical form (`fr-fr`, `FR-FR`, `fr-FR` equal). Tests `098` + selector case in `reads/050`.
m4 backfill witness. New `supabase/tests/phase_02_slice_12_taxonomy_terms/populated-terms-lineage.sql` (35 tests): real versions through the producer, `cms_terms` reverted to
the pre-migration shape with the pre-lineage hierarchy/successor guards restored verbatim, legacy rows incl. a parented MERGED row whose survivor was later DEPRECATED, the
DDL region replayed (markers `BEGIN/END TERMS-LINEAGE-DDL`, now spanning the fill function and trigger), N/N rows placed (6/6), no other column changed (digest), plus three
refusals in always-undone subtransactions. **The old successor guard does not misfire**: it fires on `UPDATE OF lifecycle, successor_id` and the hierarchy guard on `UPDATE OF
parent_term_id, lifecycle`; the backfill sets `taxonomy_id` only (proved by the merged-row-with-deprecated-survivor case). The witness found one real gap, now fixed in `120000`: a term key
repeated across versions of one vocabulary failed with a bare unique violation; it is now refused loudly with `55000 ... term key(s) repeat across the versions of one vocabulary`. Parity
test `tests/contracts/phase-02-slice-12-taxonomy-terms-witness-parity.test.ts` keeps the region byte-identical (reads the WIP file until promoted).
m5 reads. `cmsTaxonomyTermsRead` `/limit` and `/lifecycle` outside their grammar are `INVALID_REQUEST` (400, BE03c 406 `400/policy-safe 404/502`), no longer `VALIDATION_FAILED` (422). The
selector (row 403 `400/422`) is unchanged; Worker lane: map both exactly as the SQL answers.
m6 DEC-100 oracle strengthened (canonical suite): the matcher names exactly three `platform_private` objects (registry reader, provider projection, id function); exactly one CMS-definer function reads
`platform_private.role_facet_assertion`; the definer may SELECT exactly `(facet_code, state)` and has no write verb; exactly one policy admits the definer (`state = 'active'`, SELECT); as the definer the store
shows 3 rows, all active, not the removed 4th. **Policy justification** (header of 120100): BE03c 1373 fixes the provider as reading the Shard 02 role facet assertion projection, the promoted registry row
(20261013300100) names `shard02.role_facet_assertion`, DEC-100/BE03c 1571 require a named read-only projection, the table is forced-RLS with only a self-row policy for `authenticated`, and SEC-2 forbids a bypass-owned
definer reader (run 3 sec2_all #3): the least-privilege shape is the column grant + one active-rows policy + one function. It stays a root ratification (R3).
m7 D3 `parentId`. Aligned to the frozen contract: BE03c 379/381 and FE03 1792 forbid `parentId` on no action. Every action validates it with one shared `cms_term_parent_check` (hierarchical shape, live term of the
vocabulary, not self, no cycle; 422 at `/parentId`, identical for absent/foreign/merged); only create and rename APPLY it. The form's deprecate of a child (sending its current parent) is accepted.
m8 citations. "nine" -> eight `TaxonomyTermActionRequest` members; If-Match operands are BE03c 215 (not 1380). `cms_name_uuid` is now a real RFC 4122 version 5 (SHA-1, URL namespace); known-answer tests against an independent implementation.

### Test corrections (for independent review; all in this lane's own suites)

1. `040-validation`: removed rows `parent-on-alias`, `parent-on-deprecate`, `parent-on-merge` (expected 422 /parentId on a nonexistent term). They encoded the D3 narrowing of the frozen contract (BE03c 379/381, FE03 1792 forbid nothing). Replaced by 6 real-fixture refusals and 3 acceptances in `060-hierarchy`.
2. `060-hierarchy`: removed `hp-alias-parent` (same reason).
3. `reads/030`: `limit-*` and `lifecycle-*` query cases now expect `P0001:INVALID_REQUEST` (was `VALIDATION_FAILED#["/limit"]`, `["/lifecycle"]`): BE03c 406.
4. `canonical`: DEC-100 oracle strengthened (m6); the canonical id regex now requires version 5 and three known answers were added.
5. `020-surface`: the absence assertion (old lines 34-36) is replaced by the transport assertions. `085`: handler cases go through the transport instead of calling the private function with the flag pre-set.

### Files (path, SHA-256)

Migrations (`supabase/migrations-wip/taxonomy-terms/`, 13 files):
- `20261014120000_cms_terms_lineage_columns.sql` 3a6153256aaf9e802a79ec74aa0ca936623ceefddf5a816b3b0de21b20dd8879
- `20261014120050_cms_terms_guards_lineage.sql` 5b92b62b233e4629e7487158befab229377f269205db39c08d359b11ab0b4a45 (unchanged)
- `20261014120100_cms_canonical_taxonomy_match.sql` 7162cfdcda702f61398c321c0bff142786e650239e304569ba8472f1a2c45937
- `20261014120200_cms_term_action_support.sql` ddd38bebece664a63f103cb2f851d3fe3cdfcb37ef0358bb3fe64310b90f91ea
- `20261014120300_cms_taxonomy_merge_convergence.sql` de0dc56d89813441c1c92afb52ecd2934eefa3b9f5798d24029bda514cc4c8fb
- `20261014120310_cms_run_taxonomy_merge_converge_public.sql` eb399599b9b5b4b0dd5371df4da3528dc5c17aaaaa6fe9e20961fb112eeb54ba (new)
- `20261014120400_cms_term_action_apply.sql` b7c6f0e5a5b3f0c241346d592e732b6e25b1cf28c96411ae1766e5ff9a596a4b
- `20261014120500_cms_act_taxonomy_term.sql` e5d4ff829ba5b45aff17a7d0cc0ee143dc1b348821b156511f9f3b6db32b88cb
- `20261014120510_cms_act_taxonomy_term_public.sql` 81d35514aabc9135f84ab49c6626c9e118f2e483a0299b2b65461deff988ed31 (unchanged)
- `20261014120600_cms_list_taxonomy_terms.sql` 530da7067f47c9ddb6adf5f3a0227267fe2acfae856c419051519427681dfa1e
- `20261014120610_cms_list_taxonomy_terms_public.sql` dc9b949f02c4a5984a418d487c94addb1a40dfcabb155ca1dc130abfbc10ef61 (unchanged)
- `20261014120700_cms_list_taxonomy_selector.sql` 7c3ad6d1ccc730890f40850ed647df7ae6efc153ae818cd93797556f85767e1a
- `20261014120710_cms_list_taxonomy_selector_public.sql` 91f68d6983c086e9e597222aeb815f2c7add8025dd8addb6563bf5b3efc35fb2 (unchanged)

Tests: `supabase/tests/phase_02_slice_12_taxonomy_terms.sql` b0535378038c34f51b7da1b23190b1fc235d83b8355f81cae7a2f4f4f8ae4324; `..._terms_canonical.sql` e85b38c55c4470e26434a7637c18cc0600b8baccb0cd41268f93b65184b18ae4;
`..._terms_reads.sql` 5782347622b8d5d65c64ef3b3d95f6bb0afeee5bc3687a7027a5f5bd4b97083d (unchanged);
`taxonomy_terms/`: `000-world` 26187284f0035d03aa57f6945a9cc53d0e137834769c6f911ca3d568024563c1, `020-surface` 1b2076a38705ee9f3f77f9567e4e048fbe79e965bfa3e0f43fdb039786bef2ae, `040-validation` 019785d2bda2f178c0b811bb7b1c10f2ae5b92e46e8f9333365b5cb364b530bd,
`060-hierarchy` 2db1d9cae74a1e56859e51022a5ba322d8371b327df695ab42dac28940121eae, `085-continuation` 6271dc2bfc321efae2b0d1928143edca2eddb875555ca33fc07d92a756d203b6, `097-bulk-continuation` 562943085957634e873b7dc94dc74ec41e2e0fca5f581fda34c91b4a9f8e94a1 (new),
`098-locale-canonical` 43eccd95b34eb6511391b3fb728adf765cc64fc5a6eb0bb20d59a0cd07302c97 (new), `populated-terms-lineage.sql` 17ad67d78ca60606ff5fddcf3bf52bb52530ac45d7961864f4c7abfae718ffb8 (new), `README.md` updated;
`taxonomy_terms_reads/`: `030-terms-read-pages` c064911159b77d2d4460d04a83f8df21872e15ff063db43c69bdff710f6839fc, `050-selector` 74ec69e2d7bc6c316d101b556e7cf8a29964c850374da375bc2b3af802ff9809, `README.md` updated;
`tests/contracts/phase-02-slice-12-taxonomy-terms-witness-parity.test.ts` 6670f9a46b3129d9e74407fa8cee3beab6589e5c86102be3766184d26bf92a6f (new). All SQL files <= 300 lines (tests <= 400).

### RPC boundary (additions and changes for the Worker lane; no Worker file edited)

- `platform_api.cms_run_taxonomy_merge_converge(p_request jsonb) returns jsonb` (service_role only). Request exactly `{ "jobId": uuid, "batch"?: integer 1..5000 }`; answer `{ "converged": n, "remaining": m }`.
  Errors P0001: `INVALID_REQUEST` (shape), `NOT_FOUND` (no job / other job type), `CONFLICT` (deadlock or lock failure; retry). Runtime mapping: claim the job (`platform_api.claim_job`), call this with its id, then
  `remaining > 0` -> outcome `queued` (retryable, progress continuation, no error code), `remaining = 0` -> `succeeded` with `resultRef = { converged, remaining: 0 }` (`platform_api.apply_job_outcome`). The call is idempotent on re-delivery.
- `cms_list_taxonomy_terms`: a `limit` or `lifecycle` outside its grammar is now `P0001 INVALID_REQUEST` (no detail), 400.
- `cms_act_taxonomy_term` / selector: label locales are stored and matched in BCP 47 canonical case; a non-null `parentId` is accepted on every action (see m7).

### Open items / BOUNDARY

- BOUNDARY (missing spec: BE00 job progress writer). BE03c 1334 says the durable cursor "is job state"; BE00 defines `jobs.progress` but no writer function and the CMS definer cannot write `platform_private.jobs`. The data-derived cursor (D9) satisfies idempotent
  resumption; if root wants `jobs.progress` populated it needs a runtime function (or a column grant plus a policy) from the BE00 owner.
- D1..D8 stand; D3 is superseded by m7. The handler converges the merged terms of the job's whole acting party, not only the job's own retired term (the jobs table has no payload column; recorded in D7).

### Requests to root (supersede R2, R5 of the first pass; R1, R3, R4, R6 stand)

R2 API surface: FOUR new API-executable RPCs (service_role only): `cms_act_taxonomy_term`, `cms_list_taxonomy_terms`, `cms_list_taxonomy_selector`, `cms_run_taxonomy_merge_converge`.
R5 promote the 13 migrations `supabase/migrations-wip/taxonomy-terms/*` (20261014120000 .. 20261014120710, filename order, includes the new 120310), then `db:types`.
R7 ratify the CMS-definer column grant + single active-rows policy on `platform_private.role_facet_assertion` (m6), with R3's forced-table pin.
R4 (TC1) still open: `populated-lineage.sql` of taxonomy_definition cannot revert `taxonomy_id` while `cms_terms_version_lineage_fkey` exists; apply the two hunks of the first pass, delete `phase_02_slice_12_taxonomy_terms_populated_witness.sql`.
R8 promotion hygiene: after promoting, the parity test reads `supabase/migrations/20261014120000_cms_terms_lineage_columns.sql` automatically; no edit.
Not run by this lane (forbidden): canonical gates, Slice 09 pin suites (r8/sec2_all/trigger_catalog; no new trigger this pass, +1 API RPC and +2 private functions in schema `platform_private` to pin), `db:types`, Worker/web tests.

## Follow-up f2

Brief `briefs/taxonomy-terms-f2.md`, review `review-taxonomy-terms-f1.md` (CLEAR). HEAD `b16edb54` verified at start. The thirteen migrations
`20261014120000..120710` are PROMOTED and immutable; every fix is a forward migration in `supabase/migrations-wip/taxonomy-terms/`
(`20261014120800`..).

### Checkpoint 1 (plan, before any code)

- TC1 applied to `taxonomy_definition/populated-lineage.sql` (two hunks, identical to the verification copy modulo `\ir` paths).
- F1 + F3 + F2 share one new handler: request `{claimedJob:{jobId,version,leaseToken},batch?}`, lease/state fence, curator capability re-proved under
  the position 1 locks (`capability_missing`), and a FRESH continuation job (one claim each) when work remains.
- F2 basis: BE00 `platform_private.jobs.attempts` is at most 32 summaries (BE00 line 338, `claim_job` guard `< 32`) and `platform.job.execute`
  allows 4 deliveries including the initial one (BE00 consumer registry), so a long merge re-queued on ONE job strands after at most 32 claims (4 queue
  deliveries). A continuation as a fresh BE00 job bound to the same actor and acting party is the same mechanism BE03c 1334 / 1377 already use for the
  first continuation ("a BE00 jobs row bound to the actor and acting party").
- F4: partial index `(term_id, revision_id, field_definition_id, version) where state = 'active'` + plan-shape assertion.

**Status: GREEN** (one brief item, F4, answered with evidence instead of the requested index; see F4). Final run (stamp 030530-3952377, lane `taxonomy-terms`, 8 files,
2,080 tests, 0 failures): terms 391, reads 170, canonical 62, populated-terms-lineage 35, taxonomy_definition 1,334, taxonomy_definition/populated-lineage 37 (TC1),
link_integrity 26, authority 25. TAP `.lane-logs/alt-staged-taxonomy-terms-030530-3952377.tap` SHA-256 `2853787b29b15b509fd895de2f0d9697bae262877ac6b4e44e20ed1fc495b89e`.
`pnpm exec vitest run` of both parity tests (`taxonomy-lineage-witness-parity`, `taxonomy-terms-witness-parity`) after the TC1 edit: 6/6.

### Runs

| # | Stamp | Plan | Result | Class |
|---|-------|------|--------|-------|
| RED-1 | 024751-3855378 | terms (no WIP, promoted tree only) | 11 `not ok` + abort at `085:179` (TAP sha `98fa58f6...`) | feature RED: the transport answers INVALID_REQUEST to the claimed-job shape, no `continuationJobId`, no fenced handler (21, 30, 255-256, 259-268). The abort ("invalid job lease adapter input") is the consequence of the missing continuation (a NULL job id handed to `claim_job`), not a harness defect |
| RED-2 | 024854-3863193 | temporary copy of the suite with only 000, 010, 094, 096, 097, 0971 (deleted afterwards), WIP files withheld | 7 `not ok` + abort at `096:56` (TAP sha `5930d858...`) | feature RED for F1 (26, 28, 30) and F3 (17, 19, 21, 24); the abort is a HARNESS defect of mine (`s12tt_outcome` read my temp table under `service_role`: "permission denied for table s12tt_claims"), fixed in the helper. Caveat: the old transport rejects the new request shape outright, so F1/F3 RED is carried by the missing grammar as much as by the missing fence/re-proof; F2 (0971) and F4 (097) did not run in RED-2 because of the abort |
| G-1 | 025536-3897876 | 8 files, 3 WIP migrations | 2 `not ok` + abort at `096:56` (TAP sha `9b43e65e...`) | harness: (a) `platform_api.apply_job_outcome` has since been replaced by the lease-token variant (`20260830120000`: `(job, version, lease_token, state, result, error, retryable)`); the 6-argument grant no longer exists, so my helper had no privilege; (b) the fixture reads `cms_taxonomy_merge_work` directly without the RPC context flag (forced RLS returned 0) and a fixture label collided with `080` (`IDEMPOTENCY_MISMATCH`). All three fixed in the tests |
| G-2 | 025923-3919680 | same | 3 `not ok` (TAP sha `c7834e30...`) | #353-354 F4 plan shape, #373: test defect, the retired term legitimately has TWO taxonomy events (create + merge); the assertion now pins versions `1,2` |
| G-3 | 030150-3933523 | same | 2 `not ok` (#353, #355) | F4: the plan shows `cms_term_assignments_term_state_idx`, not the new index (see F4) |
| G-4 | 030530-3952377 | 8 files, 2 WIP migrations | PASS 2,080/2,080 | TAP sha `2853787b...` |

### Findings, one by one

**TC1.** The two hunks of the first pass were applied to `supabase/tests/phase_02_slice_12_taxonomy_definition/populated-lineage.sql`
(drop `cms_terms_version_lineage_fkey` before the revert; the legacy term insert names `taxonomy_id`). Byte-compared with the verification copy modulo three `\ir` paths: identical.
It passes 37/37 in G-4 (run with `taxonomy_definition`); the lineage and terms parity tests pass (6/6; the DDL region is untouched). The verification copy
`phase_02_slice_12_taxonomy_terms_populated_witness.sql` is deleted.

**F1 lease and state fence.** `platform_private.cms_run_taxonomy_merge_converge(uuid, bigint, uuid, integer)` (`20261014120810`) takes the claimed job id, version,
lease token and batch, reads the job identity, takes position 1, then re-reads the row under those locks and refuses `CONFLICT` unless `state = 'running'`,
`version = p_version`, `lease_token = p_lease_token` and `lease_until > clock_timestamp()` (the 20261005018400 predicate; BE00 consumer registry for
`platform.job.execute`: "Re-read job/aggregate/authority ... cancelled/terminal/stale -> no-op ack", lease CAS on `Job.version`; `apply_job_outcome` itself requires the same). The
Worker transport `platform_api.cms_run_taxonomy_merge_converge(jsonb)` (`20261014120820`, replaced in place, same ACL) takes
`{ claimedJob: { jobId, version: decimal-bigint string, leaseToken }, batch? }`. The old unfenced `(uuid, integer)` handler is DROPPED in the same migration.
Tests `096-job-fence`: unclaimed queued job; expired lease (1 s lease, `pg_sleep(1.3)`: state, version and token still match, still 409); after a re-claim the stale
delivery, the right version with another token, the right token with another version and a future version; a cancelled and a succeeded job (outcomes applied through
`platform_api.apply_job_outcome` as `service_role`), each refusal leaving the store byte-identical (`s12tt_same`), then the live lease converging the 2 untouched
assignments. `085`: 29 malformed request shapes, unknown job, other-type job.

**F3 capability re-proof.** BE03c 1354 rule 1 ("re-proves its capability under the position 1 locks. A revocation committed first wins: the writer is refused 403
with the operation's catalog code and writes no row") and 1351 (`cms.taxonomy.merge_converge` takes "the positions of the CMS-03C-03 merge it continues (1, 3 and 6)") name
the job; no spec text exempts it, so it is implemented, not cited away. After the fence the handler resolves the job actor's person and refuses `capability_missing`
(the CMS-03C-03 catalog code) unless `cms_person_holds_capability(party, person, 'cms.taxonomy_curator')`, under the position 1 locks, before position 3 and 6 and
before any write. **What happens to the remaining rows** (the question the brief asked to define): the call writes nothing (no assignment, job, outbox or audit row); the
unconverged assignments stay current ACTIVE rows of a MERGED term, which BE03c 1377 already resolves permanently to its survivor ("the retired id resolves permanently
to the survivor throughout"), so the delay is never a wrong answer; and the handler converges the whole acting party's merged terms, so the next run under any
holder of the capability drains the tail. Tests `094-continuation-authority`: revoked grant and lapsed validity window are `capability_missing`, store byte-identical, the 3-assignment
tail intact, the retired term still `merged` with the survivor as successor, and after restoration the same lease converges all 3. Order pinned in `085` (position 1 locks, then the
capability proof, then `for share`, then `for update`). The Worker mapping is in the RPC boundary below. BOUNDARY: no spec'd command re-requests a continuation for a tail whose
job actor lost the capability (see Open items).

**F2 chained continuation.** BE00 caps a job at 32 attempt summaries (BE00 line 338; `claim_job` guard `< 32`, `20260830120000:223`) and `platform.job.execute` allows 4 deliveries
including the initial one (BE00 consumer registry), so re-queueing ONE job after each batch (the first-pass mapping `remaining > 0 -> queued`) strands a long merge after at most
32 claims. The handler now answers `{ converged, remaining, continuationJobId }`: when `remaining > 0` it requests a FRESH BE00 job of the same type bound to the same actor, acting
party and correlation (`accept_job_with_outbox`, idempotency key `cms.taxonomy.merge_converge.continuation:<current job id>`, so a re-delivery of the current job names the SAME
continuation), and the Worker records the current job `succeeded`. This is the mechanism BE03c 1334 / 1377 already use for the first continuation ("a BE00 jobs row bound to the merge
command's actor and acting party"); the durable cursor stays the data (D9) and each continuation row is the durable record that work remains. Tests: `085` bounded batch (batch 1 over 3
rows: 1 converged / 2 left / continuation named; re-delivery names the SAME continuation and creates no second job; the continuation is queued, version 1, no attempt, same actor/party/correlation;
it converges the last row and names none) and `0971-chained-continuation`: the REAL merge command on 5,040 assignments (5,000 in the transaction, 40 left), drained through the real
`claim_job` -> transport -> `apply_job_outcome` loop with the production `batch` parameter set to 1: 40 hops (more than 32), 40 distinct jobs all `succeeded`, each claimed once
(`maxAttempts = 1`), each with its own `job.requested` outbox event, no stray or stranded job, 5,040 survivor rows with no duplicate (revision, field), the retired term has exactly its create
and merge taxonomy events (versions 1, 2). Note on the `batch` parameter: it is production request surface (range 1 .. 5000) that is not in the spec; the Worker lane should omit it and let it default to 5000.

**F4 index: premise not true; no index added (decision for root).** The review states "No index leads with `term_id` (only `UNIQUE (revision_id, field_definition_id, term_id, version)`)".
`20260927260000_cms_taxonomy_authority.sql:118` creates `cms_term_assignments_term_state_idx ON cms_term_assignments (term_id, state)`, which is exactly the predicate's lookup (merged term ->
its ACTIVE assignments). I first added the requested partial index `(term_id, revision_id, field_definition_id, version) WHERE state = 'active'` with a plan assertion; G-3 showed the
planner reads the assignments through `cms_term_assignments_term_state_idx` (Bitmap Index Scan) and never chose the new one, with seq scans disabled. A second index with the same leading
columns would only add write cost to an append-only table (and the function is a non-inlined SQL function, so a batch limit cannot be pushed into an ordered index range either), so the
migration was deleted. `097` now pins the plan shape of the REAL function body (parameters replaced by literals, `enable_seqscan = off`): the per-term and whole-party lookups both read through
`cms_term_assignments_term_state_idx` and neither contains a Seq Scan of `cms_term_assignments`, so dropping or reshaping that index fails here. If root still wants a covering index for
ordered batch reads, it is a one-file forward migration; I recommend against it without a measurement.

**Citation nits.** (1) The terms-read matrix row is BE03c **407** (406 is `cmsTaxonomyVersionsRead`): corrected in `reads/030-terms-read-pages.sqlinc` and `reads/README.md`; the promoted headers
of `20261014120600` keep the old number (immutable) and are superseded by this line. (2) DEC-100 ("Shard 02 accepts bounded inbound evidence ... without upward store reads") is a direction
decision about Shard 02 reading higher-numbered stores; it does not itself require a "named projection". The operative clause for the role provider is BE03c 1373 (the matcher compares with the
domain's named read-only projection; the role provider reads the role facet assertion projection; the clause cites DEC-100 only for "never reads another shard's store directly"). The canonical
suite labels now cite BE03c 1373; the header of `20261014120100` (which cites "BE03c 1571 and DEC-100 require a NAMED read-only projection") is promoted and stays, superseded by this paragraph
(BE03c 1571 concerns provider registration by forward migration).

### Files (path, SHA-256)

New WIP migrations (`supabase/migrations-wip/taxonomy-terms/`):
- `20261014120810_cms_taxonomy_merge_handler_fenced.sql` 52a61e91bcd36ad17abc5ef8e297492810c565402b4d70a1419201460b552ac7 (137 lines)
- `20261014120820_cms_run_taxonomy_merge_converge_claimed.sql` b1e63645f8f058e5c14974762aac39d45b6a2208d6cf68db4af6c2cd0cad05b0
(`20261014120800` was written and deleted: see F4. The gap in the sequence is intentional; filename order is the apply order.)

Tests: `supabase/tests/phase_02_slice_12_taxonomy_terms.sql` b8861716e521bb24fca6165ff04203d265e2b0785501432902fd5d1b592246e5 (includes the three new fragments);
`taxonomy_terms/`: `000-world` 1541379e88b4f9fe6f29744676d7c6cdb7fbe199b1d51c636247841f3379f42c (361 lines; new helpers `s12tt_claim`, `s12tt_claimed`, `s12tt_outcome`, `s12tt_drain`, `s12tt_work`),
`020-surface` 111fcdb9cc597f60ff2e7af29daf3c3b79574f51bb7cad47687567690c9d8db5, `085-continuation` a3b68f8d01b0f03fd746a4c41c7e4b818138fe3aeba7ece987aed96c9b169e4f,
`094-continuation-authority` (new) 3b60d1829e0bccafda1028b46572aabe504435092dbfe3b83e7cab6c25c8bf85, `096-job-fence` (new) bc8f191f51f26a477f3dd26fa6157171c37035679bc8ea719d2f2d4b4f88c083,
`097-bulk-continuation` 9dad1eba6e0ccad1ea56150172c4a7f4187ae4f9ad5f4f31eefdb7b987ee1ea7, `0971-chained-continuation` (new) 79d5549f1267c6369f60d0b894b33e8f71159834ba4bd86f4171e0eae1123b84,
`README.md` 5eb5d40311592d01af98b2d307a894f110760b8971f2862137e72d213afc3878; `phase_02_slice_12_taxonomy_terms_canonical.sql` 3683ce2d58e22539cea9e6cbb08b732d509672dc6840e2f2e62f6a574d671954;
`taxonomy_terms_reads/030-terms-read-pages.sqlinc` 771d6f82a35c7cb5671975c968695d0d74a793b1a302c83c93c63668287fa527, `README.md` 6ef325617de9cacc82818824e48b0aaeb4f77f3bf10078d4c3b4dd9ea19586e7;
`taxonomy_definition/populated-lineage.sql` (TC1) e2bad1a60dc66fad7b608317bec7d37b5afa84bed0254bac08d1169f43b339d2.
Deleted: `supabase/tests/phase_02_slice_12_taxonomy_terms_populated_witness.sql`. All SQL files <= 300 lines (max 137), tests <= 400 (max 361).

### Test corrections (for independent review; all in this lane's own suites, none weakens an oracle)

1. `020-surface`: the handler is asserted with its new signature `(uuid, bigint, uuid, integer)` and, new, that exactly ONE overload exists (the unfenced `(uuid, integer)` is gone).
2. `085`: the transport grammar changed with the feature (`{ claimedJob: {...}, batch? }`, answer carries `continuationJobId`); the 11 old malformed shapes became 29; the "budget of 2 over 3 rows" case became "batch 1 over 3 rows with a fresh continuation job" (the old mapping `remaining > 0 -> queued` is the F2 defect and is no longer an expected behaviour); the job row is now `running` at the claimed version (no longer `queued`, version 1) because the handler is only reachable under a lease.
3. `097`: transport request/answer shape only (claimed job, `continuationJobId: null`).
4. `canonical`: assertion TEXT only (citations BE03c 1373 instead of DEC-100); `reads/030` + README: comment/README text 406 -> 407. No assertion logic changed.

### RPC boundary (supersedes the first pass and the fix pass for `cms_run_taxonomy_merge_converge`; no Worker file edited)

`platform_api.cms_run_taxonomy_merge_converge(p_request jsonb) returns jsonb` (service_role only; same ACL, replaced in place).
- Request exactly `{ "claimedJob": { "jobId": uuid, "version": "<decimal bigint string>", "leaseToken": uuid }, "batch"?: integer 1..5000 }` (Worker: omit `batch`).
- Answer `{ "converged": n, "remaining": m, "continuationJobId": uuid | null }`.
- Errors (P0001): `INVALID_REQUEST` (shape), `NOT_FOUND` (no job / other job type), `CONFLICT` (lease or state fence, or lock/deadlock; retryable only for the lock cases), `capability_missing` (job actor lost `cms.taxonomy_curator`; 403).
- Runtime mapping: `platform_api.claim_job` -> this call with the claimed `version` and `leaseToken` -> `platform_api.apply_job_outcome` (the lease-token variant) `succeeded` with the answer as `resultRef`. A named
  `continuationJobId` is already a queued BE00 job with its own `job.requested` event (the platform queue delivers it); do NOT re-queue the current job. `capability_missing` -> `failed` (non-retryable,
  `CAPABILITY_MISSING`). `CONFLICT` from the fence means a stale delivery: acknowledge without an outcome (the BE00 no-op ack); `CONFLICT` from a lock failure is retryable.

### Open items / BOUNDARY

- BOUNDARY (missing spec: a recovery trigger for a stranded tail). If the job actor loses the curator capability mid-chain, the handler refuses and the tail waits (still resolved through the redirect, BE03c 1377).
  BE03c defines no command by which another curator re-requests a continuation of an already-merged term (the merge itself is 409 on a merged term), so the tail is drained only when a later
  continuation job of the same acting party runs under a holder of the capability. Needs a spec'd re-request command (BE03c owner), or an ops runbook entry.
- BOUNDARY (unchanged): BE00 `jobs.progress` writer for a stored cursor (D9).
- Not changed (outside the f2 brief): the reviewer's nit that a `limit` of `1.0` passes the floor check and raises an unmapped 22P02 in `cms_list_taxonomy_terms` (unreachable through the Worker's Zod
  re-serialization; a forward re-creation of the promoted function would fix it). The residual "alias with a different valid parent is accepted and not applied" stays as documented.

### Requests to root

R9 promote `supabase/migrations-wip/taxonomy-terms/20261014120810_*` and `20261014120820_*` (filename order, after the thirteen promoted ones), then `db:types` (the wrapper's request contract changed; one private function was replaced).
R10 Slice 09 pin suites (r8 / sec2_all / trigger_catalog) if they enumerate `platform_private` functions by argument list: `cms_run_taxonomy_merge_converge(uuid,integer)` is gone and `(uuid,bigint,uuid,integer)` replaces it (net count unchanged; the API surface is unchanged: same four RPC names).
R11 decide F4 (see above): I added no index. Say so if you want the covering index anyway.
R12 Worker lane: map the new request/answer and the outcome rules in the RPC boundary above; omit `batch`.
R13 spec owner (BE03c): either ratify "capability lost -> tail waits, drained by the next authorized continuation" or add a re-request command (BOUNDARY above).
Not run by this lane (forbidden): canonical gates, Slice 09 pin suites, `db:types`, Worker/web tests, race modules.

Memory capture: one candidate pattern for root (not written; memory files are outside this lane): a review finding's factual premise ("no index leads with term_id") was checked against the migrations before acting, and was false.
