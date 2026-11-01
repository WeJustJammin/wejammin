# Lane taxonomy-def: CMS-03C-16 create and cmsTaxonomyVersionsRead SQL producers

Lane `claude_s12_taxonomy_def_sql` (staged-runner lane `taxonomy-def`), 2026-10-14, model claude-sonnet-5-5.
Worktree `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`, branch `claude/phase2-slice12`, HEAD
`b16edb54a7a1b698ed8ca15b6085046d4270626e` (verified at start and at the end; no git write was issued).

## Status

GREEN. Final run (8): the entry suite plans 1..1328 and passes 1328/1328; the standalone populated-table witness
plans 1..37 and passes 37/37; pg_prove exit 0, zero harness aborts, plan grew from the prior RED's 1143 to 1328.
Nothing is blocked on governed 07/08/09. The five assertions that were blocked by the CMS-03C-06 submit refusal
carrying no `details.domain` pass through an optional cross-operation migration (030500, see Requests to root).

## Scope

- `supabase/migrations-wip/taxonomy-def/`, timestamps 20261014030000..20261014030500 (inside my range).
- `supabase/tests/phase_02_slice_12_taxonomy_definition.sql` and `supabase/tests/phase_02_slice_12_taxonomy_definition/`.
- This report. Nothing else was edited. No applied migration, shared helper or other lane's file was touched.

## Files

Migrations (WIP, to be promoted by root), SHA-256 of the final bytes:

| Path (under `supabase/migrations-wip/taxonomy-def/`) | Lines | SHA-256 |
| ---------------------------------------------------- | ----- | ------- |
| `20261014030000_cms_taxonomy_lineage_columns.sql` | 167 | `fda701e120c0a02f061130372ab2e598871e905ddbd55e0a751bafc1cd336a39` |
| `20261014030100_cms_taxonomy_versions_lineage_guard.sql` | 83 | `748ba8f9aed80c4cf05ea3ba7487c98655808d4f33d274a6e9e719956aa69ca5` |
| `20261014030200_cms_create_taxonomy_version.sql` | 226 | `d9e266cf1bd8ad6180c03240d575d1366de14b6d6f66fb51a5505a9c7f55085a` |
| `20261014030300_cms_create_taxonomy_version_public.sql` | 42 | `9dd30a6a02d73127b4263ea22b6645ba6dda82116190279f02128e868d1e6dc8` |
| `20261014030400_cms_list_taxonomy_versions.sql` | 134 | `e4a3feef529be90738cd192815028cc2504233dcb1a1453094a23379707242e7` |
| `20261014030500_cms_submit_canonical_source_detail.sql` (optional, cross-operation) | 63 | `f41cf1c72d0587c95601c15c97cbb91cb688fbb351dff0f3a0078c885e22c600` |

Tests (`supabase/tests/`), SHA-256 of the final bytes:

| Path | Lines | SHA-256 | Change |
| ---- | ----- | ------- | ------ |
| `phase_02_slice_12_taxonomy_definition.sql` | 29 | `e7301d90a5f2319b87aa1ca8341e5999a9a03a2539fbc11d6c37e37de9f6a4a7` | two includes added |
| `.../000-harness.sqlinc` | 153 | `2514dbe0fbe51011f02d0b1314c0695eb2bf1028f2cf830bae26757a301f11dc` | `read` operation, `s12td_read_request`, `s12td_attempt` helpers added |
| `.../010-identities.sqlinc` | 102 | `dbd8df62074f264306c79c384b2ed9dc60de753708440cdd0b9fc084dbba28c2` | unchanged |
| `.../020-oracles.sqlinc` | 107 | `1ab4f467acbdfcf43009f3fb9ab6e473a79844f99917ec966dd9aee43e5a12dd` | unchanged |
| `.../030-create.sqlinc` | 75 | `204c8d6f25c5b9c7f5225ea837613ffe38081f6a89771b7ada2eff8e900aef4e` | unchanged |
| `.../040-validation.sqlinc` | 121 | `180e62753ea6748099d37056c0a53a59e103b499a94c59b3805ea101afd6233f` | unchanged |
| `.../050-authority.sqlinc` | 92 | `93c5fc39eb307348900e1c3593cf5124a0ab5b5e685f8ec847113cf40e1ac4b6` | unchanged |
| `.../060-review-successor.sqlinc` | 151 | `dc1e044fb9347cc4fa4861121095139359dc7aa781ce3a6254caf8b4d27f94ef` | one oracle correction (below) |
| `.../070-versions-read.sqlinc` | 161 | `7d983d92c31429aed84bb94aeb21051a595150c56ed68fa4d601f75a0b2d8fbd` | new |
| `.../080-schema-guards.sqlinc` | 156 | `70aece7d497210ea7eae5ee91c41756fcf910e4efbf8d7f387d44b86ee574fba` | new |
| `.../populated-lineage.sql` | 280 | `fdd48ecd7f2f3f9fafb4929fcb619b43e45d83c17ee7603fa3ba2963d91aa808` | new, standalone pgTAP file |
| `.../README.md` | 50 | `fe3ebf3ca629d216e2fb1d3cfab6ff17c93e4ecbd16940171e7ca03cb5f3cc4c` | rows added |

## What was built

1. `030000` storage. Adds `taxonomy_id`, `supersedes_id`, `canonical_overlap_domains` (BE03c:219,1427); makes the key unique
   per owner (`UNIQUE (owner_id, taxonomy_key, version)` replaces the global unique, E14, BE03c:218), `UNIQUE (taxonomy_id, version)`,
   a partial `UNIQUE (taxonomy_id) WHERE state = 'active'`, composite FKs `(taxonomy_id, owner_id)` and
   `(supersedes_id, owner_id)` to `(id, owner_id)`, a CHECK through `cms_canonical_domains_valid` (closed set, unique, at most six,
   DEC-135), and grants INSERT to `wejammin_cms_definer`.
2. `030100` guard. Replaces `cms_taxonomy_versions_lifecycle_guard` keeping its every prior rule and the governed-lifecycle early
   return (300000). New: insert starts at lifecycle 1 with no stamps; a first version must be the only row of (owner, key) and is its
   own lineage root; a successor names a same-owner, same-key parent whose number is exactly one less and carries the parent's
   lineage; an omitted lineage id is filled, a wrong one refused. Definer-owned (it now reads the forced table).
3. `030200`/`030300` CMS-03C-16. `platform_private.cms_create_taxonomy_version(jsonb)` plus `platform_api` wrapper (service_role only,
   deadlock/lock failure becomes typed `CONFLICT`, RPC flag restored). Order: object body, actor/party, concealment (`NOT_FOUND`),
   position-1 authority fence and capability re-proof (`FORBIDDEN`), advisory lock per (owner, key), idempotency reservation (replay
   only for a caller who still holds the capability), exact members, member values (`VALIDATION_FAILED` at the member pointer), decoded
   If-Match operand (`INVALID_REQUEST`), latest row `FOR UPDATE` and CAS (`CONFLICT`/`NOT_FOUND`), draft insert, one audit row,
   completed reservation. No outbox event.
4. `030400` cmsTaxonomyVersionsRead. `cms_list_taxonomy_versions(jsonb)` plus wrapper. Strict `{ taxonomyId }`; answers the witness
   `{ taxonomyId, page: { items, pageVersion } }`; at most 50 versions newest first, each equal to the resource its create answered;
   `pageVersion` is the page's high-water `updated_at` in UTC microseconds (decimal string); an absent, foreign or non-lineage id is 404.
5. `030500` (optional): amends `cms_submit_governed_review` by one asserted-once text anchor so its `canonical_source_unavailable`
   refusal carries `DETAIL {"domain": <first unbuilt declared domain>}` (BE03c:1314,1375).

## Runs

All through `lane-db-alt-staged.sh /home/rob/.codex/worktrees/phase2-slice12/WeJammin taxonomy-def <files>` with `PATH` pinned. TAPs are under
`.lane-logs/` of the worktree.

| # | Local time | Stamp | WIP | Files | Result | Class |
| - | ---------- | ----- | --- | ----- | ------ | ----- |
| 1 | 02:05 | 020502-2039159 | 0 | entry | aborted at `070:43` after 1152 emitted | harness (mine): `-` binds tighter than `#>`; parenthesised |
| 2 | 02:06 | 020601-2044496 | 0 | entry | aborted at `070:107` after 1182 emitted | harness (mine): labels `body-*` collided with 040; prefixed `read-` |
| 3 | 02:07 | 020715-2051160 | 0 | entry | plan 1..1312, 380 pass / 932 fail, exit 0 | RED: producer, read and lineage storage absent; every failure cascades from that. Null=null passes in 070 (1151-1153, 1156) are vacuous while the prerequisite create fails. |
| 4 | 02:09 | 020913-2061264 | 5 | entry | plan 1..1312, 1306 pass / 6 fail | GREEN except 1061-1065 (submit lacks `details.domain`, not my operation) and 1067 (oracle read the forced-RLS registry outside an RPC context: test defect, corrected) |
| 5 | 02:12 | 021246-2080209 | 5 | entry + witness + 13 regression files | entry 1312, 5 fail (1061-65); witness aborted at `:183` (my fixture: two owners holding one key cannot be reverted to the legacy global unique); regression see below | |
| 6 | 02:14 | 021438-2090681 | 5 | entry + witness | entry 1325, 5 fail (1061-65); witness 37/37 | 070/080 additions and the witness fixed |
| 7 | 02:16 | 021614-2101633 | 6 | entry + witness + governed_submit + taxonomy_authority + link_integrity | entry 1325, witness 37, governed_submit 60, link_integrity 26 all pass; taxonomy_authority 24/25 | 1061-1065 pass with 030500; one remaining failure is a stale oracle outside my files (Requests to root) |
| 8 | 02:17 | 021725-2109468 | 6 | entry + witness | pg_prove exit 0; entry 1..1328 all pass, witness 1..37 all pass | final GREEN |

Final run TAP: `.lane-logs/alt-staged-taxonomy-def-021725-2109468.tap` (83,468 bytes) SHA-256
`07a40f0ae39d4db6792081d38219fe26bbe7012a7886bcd7964982d49b053e6a`; manifest SHA-256
`0ba88ce4caa91076cdfffe853e0aadf8ad1d9e6850afd5d56fc51ae7dcbd6b1a` (promoted=373, wip=6).
Other TAP SHA-256: run 1 `8fc9cec7dbcef3f4b16d84ffa573c6195a856ac33b7b2ae5efa3acbbe0362605`; run 2
`112106356ae3340b50d8bce48c627d67e724b20951880840b7f8856737b808fa`; run 3 `3a7e060c354d7905845e1f5559fdd80fd5834693905f961b953134a6ee41c0fe`
(2,623,523 bytes); run 4 `f6284e8a1a7aee6d577f05f7965a38576b1f9c6578da7d82bf1f479a71090a17`; run 5
`4526bd3dd1c6bf3dfadc1f9b3b5417e8ce43a761971b12f1b681aa4454fa76ff`; run 6 `3aa7a8225c9c3e30ee28a967f420b56a367903fbb04fb30ccd09c7153cf2f6d4`;
run 7 `79dcd9c4a2558afd643debdd8f18a4f16307d16bcb3315516163796d1d79828b`.

Regression files run once (run 5, with the five WIP migrations 030000-030400), classified against the regression question "did my migrations break
an existing suite":

| File | Result | Attribution |
| ---- | ------ | ----------- |
| `phase_02_slice_09_sec2_all_schema_definer_rls.sql` | tests 6, 12 fail | not mine: the diff is exactly the governed tables (`cms_canonical_domain_registry`, `cms_governed_review_*`, `cms_governed_activation_schedules`) added by 20261013300100-300700; the pinned list was never updated. No taxonomy table is in either diff. |
| `phase_02_slice_09_sec2_definer_rls.sql` | test 11 fails | same cause (`cms_governed_activation_schedules:wejammin_cms_definer`) |
| `phase_02_slice_12_taxonomy_authority.sql` | test 5 fails | mine, intended: the oracle pins the dropped global constraint name (see Requests) |
| `phase_02_slice_11_recheck_index/helpers_manifest/recheck_run.sql` | abort at `phase_02_slice_11_helpers/003-registry.sqlinc:55` | not mine: `null value in column "lifecycle_version" of relation "cms_pattern_versions"` (a raw pattern-version fixture meeting the 300000 column); touches no taxonomy path |
| `phase_02_slice_09_evidence_trigger_catalog`, `slice_10_ev_ea_lineage`, `slice_10_compare_lineage`, `slice_11_helpers_references`, `slice_12_taxonomy_link_integrity`, `slice_12_governed_submit` (60), `slice_12_composition_authority` | pass | |

I did not run a `none` baseline for the not-mine rows; the attribution rests on the failure text, which names no object I changed.

## Test corrections

One existing oracle changed, minimally. `060-review-successor.sqlinc`, assertion "built-domain review freezes exactly its real provider
registry identity" (run 4 #1067: have `[{"kind":"canonical_domain","refId":"6be9ffc1-..."}]`, want `NULL`). The expected value is read through
`platform_private.cms_canonical_domain_current('role')`, a definer function over a forced-RLS table whose policy admits a row only inside an RPC
context (BE03c:1451 "CanonicalDomainRegistry has no browser or service-role read"; `20261013300100_cms_canonical_domain_registry.sql` policy
`cms_canonical_domain_registry_rpc_policy`). The `platform_api` wrapper restores the flag on return (SEC-2), so the oracle's own read saw no row
and compared against `NULL`. The production result was correct (one `canonical_domain` dependency with a refId). Diff (no assertion weakened):

```
+-- The registry is forced-RLS and readable only inside an RPC context (BE03c:1451; 20261013300100 policy),
+-- which a platform_api wrapper restores on return; the oracle's own read enters that context explicitly.
+select set_config('app.cms_rpc','true',true);
 select is((select jsonb_agg(jsonb_build_object('kind',d.kind,'refId',d.ref_id) ...   (unchanged)
   'built-domain review freezes exactly its real provider registry identity');
+select set_config('app.cms_rpc','',true);
```

Additions (not corrections): `000-harness` gained the `read` operation (`platform_api.cms_list_taxonomy_versions`), `s12td_read_request`
and `s12td_attempt` (an always-rolled-back probe that only sets the RPC flag); `070` and `080` are new. Entry file: two `\ir` lines.

## Spec citations

- CMS-03C-16 / cmsTaxonomyVersionsRead rows: BE03c:166 (versions read), 178 (create). Validation: 401 (create), 406 (read). Contracts: 771-796,
  955-960, 1166-1169; frozen `taxonomy-version.ts`, `key-grammar.ts`, `canonical-taxonomy-match.ts`.
- Immutable `version`, private `lifecycle_version`, lifecycle updates only through governed RPCs: 208 (DEC-188). If-Match operands: 215.
  Per-owner uniqueness E14: 218. Lineage ids and `supersedes_id`: 219. Row definition and delta: 1427.
- Lock order, CMS-03C-16 positions 1, 3, 4: 1336-1346; typed deadlock to 409: 1357.
- Declared domains accepted at create, refused at submission/activation/term action: 1371-1375 (D10, OD-1, DEC-135); `canonical_source_unavailable`
  with `details.domain`: 1314, 1304.
- Authorization, concealment (403 vs 404): 166,178,1477,1480; error catalog: 1295; grants `cms_create_taxonomy_version`, `cms_list_taxonomy_versions`: 1447.
- Fixed decisions honoured: strict `{ taxonomyId, page }` witness, decoded `ifMatch` operand, owner concealment, declared-but-unbuilt domain accepted at create.

## Hazard dispositions

1. Taxonomy term lineage/FKs versus version rows. `cms_terms.taxonomy_version_id` keeps its FK to `(id, owner_id)` of a version row. A version
   row is never deleted (guard), never re-pointed and its definition columns are frozen, so that FK stays valid across successors; the witness
   shows a term surviving the migration (#29). Re-keying terms to `taxonomy_id` with `UNIQUE (taxonomy_id, term_key, version)` (BE03c:1371) is
   CMS-03C-03's migration; creating a version never touches a term (suite 030/060 assert the term stores are untouched).
2. Version-row FK versus stable lineage. `(taxonomy_id, owner_id)` and `(supersedes_id, owner_id)` reference `(id, owner_id)`; the root is its own
   lineage (a self-reference satisfied in the inserting statement); the guard keeps lineage, owner, key and number consistent; tests in 080.
3. Ambiguous populated-legacy backfill. Deterministic when each (owner, key) holds exactly versions 1..n with at most one active: lineage root is
   version one, parent is the previous number. Any other shape is refused with SQLSTATE 55000 naming the count (witness #17-#21: a version gap and two
   actives both refuse and leave the legacy table untouched). The backfill equals what the producer assigns (#24).
4. Immutable guarded definition fields. The whole-row comparison covers the three new columns; 080 asserts each definition column, `created_at`,
   `lifecycle_version`, `activated_at` and `retired_at` refuse a non-governed change and a delete (15 + 1 probes, all `CONFLICT`).
5. SECURITY DEFINER callee privilege closure. Every callee of the producer, the read and the guard is definer-owned or executable by
   `wejammin_cms_definer`; 080 derives the callee list from `prosrc` and asserts it (N/N), plus ownership, empty `search_path` and API-role revokes
   for both transports and the private functions. The new validator is revoked from API roles and granted only to the definer. INSERT on the table
   is granted to the definer in 030000. `cms_key_hash`/`cms_request_hash` are reached only through `cms_reserve`.
6. Concurrent CAS/replay and atomicity. Reasoned, not race-run (race modules are root-only): the position-1 `FOR SHARE` fence plus capability re-proof
   serializes revocation; an advisory lock per (owner, key) serializes a first version; the latest row is locked `FOR UPDATE` before the CAS; the
   reservation resolves duplicates; a residual unique violation is `CONFLICT`; deadlock/lock failure is typed `CONFLICT` with nothing committed. All
   writes (reservation, draft, audit, completion) are one function call in one transaction; every refusal compares thirteen full stores before and
   after, which proves a refusal after the reservation (validation, CAS) leaves no reservation, row or audit behind. No injected post-write fault test.
7. Idempotent replay returns the identical resource: `flat-replay`, `create-replay-after-submit`, `successor-replay`, `restored-replay` compare the
   exact stored body (including hash and timestamps), also after the subject moved to review.

## Open items / BOUNDARY

- Not covered: injected mid-write fault, concurrent races, HTTP/rate/deadline/OpenAPI, definition number overflow at 2147483647 (the CAS guard
  exists, untested without a bypass), and the CMS-03C-03 term re-keying. No BOUNDARY stub was needed; every behavior had a spec line.
- Allowlist type and field keys are grammar-checked at create, not resolved against content types: binding is resolved at submission through
  `cms_governed_bound_versions` (BE03c lock-order position 4 for CMS-03C-16 therefore takes no content-type rows here; the suite requires a create with
  an unbound type key to succeed).
- 3 slice-11 suites abort on a pattern-version fixture (not mine, see regression table).

## Requests to root

1. Promote `20261014030000`-`030400`; decide on `030500` (it changes CMS-03C-06's refusal DETAIL only; idempotent, asserts one anchor and compares every
   pg_proc attribute but the body). If the governed lane owns CMS-03C-06 it may instead carry the same DETAIL, then drop 030500; suite 060 #1061-1065 require it.
2. Edit `supabase/tests/phase_02_slice_12_taxonomy_authority.sql:78`: replace `to_regclass('platform_private.cms_taxonomy_versions_key_version_key')`
   with `to_regclass('platform_private.cms_taxonomy_versions_owner_key_version_unique')`. The oracle pins the global unique that BE03c:218 (E14)
   replaces; run 7 test 5 is the only failure of that file. I did not edit it (not my file).
3. Add `tests/contracts/phase-02-slice-12-taxonomy-lineage-witness-parity.test.ts`, modelled on the template one, comparing the text between
   `-- BEGIN TAXONOMY-LINEAGE-DDL` and `-- END TAXONOMY-LINEAGE-DDL` in `20261014030000_...sql` and `populated-lineage.sql` (verified byte-equal at
   5,750 characters). Promotion must not alter that region.
4. Run `pnpm db:types` after promotion (two new `platform_api` functions, three new columns). Re-run `phase_02_slice_09_sec2_*` after promotion: the
   pinned table list is stale for the governed tables regardless of this lane; a taxonomy-specific delta is none.
5. Optionally a race module for create (two concurrent first creates of one key; create versus curator revocation; replay versus create).
6. `phase_02_slice_09_sec2_all_schema_definer_rls.sql` 6/12 and `..._sec2_definer_rls.sql` 11, and the slice-11 `cms_pattern_versions.lifecycle_version`
   fixture null, need their owners; neither involves taxonomy.

## Follow-up pass

Brief `briefs/taxonomy-def-f1.md`, started 2026-10-14. HEAD `b16edb54a7a1b698ed8ca15b6085046d4270626e` verified at start.
Status: PARTIAL by design: every assertion passes except the five classified `blocked-on-governed-fix` (060 #1061-1065); plan 1..1334 never shrank; zero harness aborts.

Plan (tests first, then SQL, one deliberate run per change):
1. F1: both producers raise `capability_missing` (BE03c:1304 lists it as the 403 reason token; the frozen Worker
   `taxonomyRpcFailure` maps it to 403 `details.reasonCode`). Eight oracles (050 x6, 070 x2) change the expected token.
2. F3: create reads `platform_private.cms_canonical_domain_current` for every declared domain (route row 178);
   new `090-registry-read.sqlinc` proves the read by replacing that function inside a rolled-back probe.
3. F4: 060 oracle reads the registry directly as the superuser; the `app.cms_rpc` toggle is removed.
4. Parity test `tests/contracts/phase-02-slice-12-taxonomy-lineage-witness-parity.test.ts`.
5. 060 #1061-1065 classified `blocked-on-governed-fix` (030500 moved to `migrations-wip/governed-fix/`).

Run 9 (RED, tests changed, SQL unchanged): 06:34 local, stamp `063419-3093661`, WIP 5 (030000-030400), entry file only.
Plan 1..1334 (was 1328; +6 in `090`), 1310 pass / 24 fail, no harness abort. TAP
`.lane-logs/alt-staged-taxonomy-def-063419-3093661.tap` SHA-256 `786582cdf606c956240508bf8441205e5b66f27355ccd6b354a2a42121744119`.
Failures, all genuine missing behavior:
- F1 (16): 977,979,981,983, 1003,1005,1007,1009, 1012,1014,1016,1018, 1176,1178, 1256,1258 -- have `FORBIDDEN`, want `capability_missing`.
- F3 (3): 1329,1331,1334 -- registry read absent (hidden domain still created).
- 1061-1065: `blocked-on-governed-fix` (030500 now lives in `migrations-wip/governed-fix/`, not staged for this lane).
- F4: 060 #1067 passes with the direct registry read.

Run 10 (GREEN apart from the blocked five): 06:35 local, stamp `063528-3101048`, WIP 5 (030000-030400), entry + populated witness.
Entry plan 1..1334: 1329 pass / 5 fail; witness plan 1..37: 37/37; `Files=2, Tests=1371`, pg_prove exit 1 only because of the five.
TAP `.lane-logs/alt-staged-taxonomy-def-063528-3101048.tap` SHA-256 `ecd728b0fdbbeac668f0f3f489a046de784fdd7e76ea00b932a2c444682decce`
(manifest `9427f8723afa9c208de8b7a77c344cddcd2f50b3777aa62631974bac48d0dbf0`, promoted=373 wip=5).
First failing test: 1061. Classification of 1061-1065 (instrument, gear, place, rights, jurisdiction): `blocked-on-governed-fix`;
the failure is `have NULL want <domain>` on the submit refusal DETAIL, owned by the amendment now in
`migrations-wip/governed-fix/20261014030500_cms_submit_canonical_source_detail.sql`, which this lane's run does not stage. Not faked. They are
the same assertions that passed in run 7/8 when 030500 was staged with this lane.

### Findings dispositions

| Finding | Disposition |
| ------- | ----------- |
| F1 | Fixed. `030200` and `030400` raise `capability_missing` (BE03c:1304 lists it as the 403 reason token; the frozen Worker `taxonomyRpcFailure` maps token `capability_missing` to 403 `details.reasonCode`, `taxonomy-definition-response.ts:116`; the governed submit raises the same token). |
| F3 | Fixed. After the shape/closed-set check, create requires `platform_private.cms_canonical_domain_current(domain)` to return a row for every declared domain, else `VALIDATION_FAILED` at `/canonicalOverlapDomains`; unbuilt domains still accepted. The table CHECK keeps the closed-set validator (a CHECK cannot read a table); `030000` header and `030200` header record that a seventh registered domain must extend the validator and CHECK. Proof in new `090`. |
| F4 | Fixed. 060 reads the registry directly as the test superuser (`order by version desc limit 1`, the reader's own definition); the `app.cms_rpc` toggle is gone. Meaning preserved: the expected refId is the registry's current `role` row id. #1067 passes. |
| parity | Added `tests/contracts/phase-02-slice-12-taxonomy-lineage-witness-parity.test.ts` (3 tests; reads the migration from `supabase/migrations` if promoted, else from `migrations-wip/taxonomy-def`). Verified non-vacuous: a one-byte drift in `populated-lineage.sql` made it fail, then the file was restored (SHA-256 unchanged `fdd48ecd...`). `vitest run` of the file: 3/3; prettier clean. |
| F2, F5, F6, F7 | Not in this pass (F2 spec note and F5 promotion order are root decisions; F6 pre-existing, outside scope; F7 no change). |

### Test corrections (this pass; for independent review)

Eight expected tokens, `FORBIDDEN` -> `capability_missing` (BE03c:1304 "403: `capability_missing`"; the assertion text, SQLSTATE, snapshot oracle, and everything else unchanged):
`050-authority.sqlinc` lines 5, 8, 49, 51, 61, 63 (`readable-not-curator`, `member-fresh-create`, `revoked-replay`, `revoked-fresh`,
`expired-replay`, `expired-fresh`) and `070-versions-read.sqlinc` lines 78, 118 (`read-not-curator`, `read-revoked`).
`060-review-successor.sqlinc`: the two `set_config('app.cms_rpc', ...)` lines removed and the expected value now reads
`platform_private.cms_canonical_domain_registry` directly (`select r.id ... where r.domain = 'role' order by r.version desc limit 1`) instead of
`platform_private.cms_canonical_domain_current('role')`. Same assertion text, same expected value (the current `role` registry row id).
Additions (not corrections): `090-registry-read.sqlinc` (6 assertions, plan 1328 -> 1334); entry file `\ir 090`; README row.

### Files after this pass (SHA-256)

| Path | Lines | SHA-256 |
| ---- | ----- | ------- |
| `supabase/migrations-wip/taxonomy-def/20261014030000_cms_taxonomy_lineage_columns.sql` | 169 | `4981f14caab510c2a4340dd46057b8bace02b9f15cba627723a1c629bec6cedc` |
| `.../20261014030100_cms_taxonomy_versions_lineage_guard.sql` | 83 | `748ba8f9aed80c4cf05ea3ba7487c98655808d4f33d274a6e9e719956aa69ca5` (unchanged) |
| `.../20261014030200_cms_create_taxonomy_version.sql` | 237 | `1a7b88e8f98639873300c4fe7788983209caa2818c1aa0ac39b1fbdabe326692` |
| `.../20261014030300_cms_create_taxonomy_version_public.sql` | 42 | `9dd30a6a02d73127b4263ea22b6645ba6dda82116190279f02128e868d1e6dc8` (unchanged) |
| `.../20261014030400_cms_list_taxonomy_versions.sql` | 134 | `78002f035993191f04e3c7ae8817e76a02ad924f3ae53faeb2d60480cb751066` |
| `supabase/tests/phase_02_slice_12_taxonomy_definition.sql` | 30 | `81ea28501d148a6e613ce82f8cf67568b5156933729a7b002009f16070bf1619` |
| `supabase/tests/phase_02_slice_12_taxonomy_definition/050-authority.sqlinc` | 92 | `ec631524d1dbca24890970ecbde9a10e05c9e6109c93c3e26724b2a7133a2a73` |
| `.../060-review-successor.sqlinc` | 151 | `4b37086544ac9bd6daeeb598c2c567c6d1a9b7e534a29f6025384f7ba50ed94e` |
| `.../070-versions-read.sqlinc` | 161 | `bd3acb44316702d1c3d45dca31e1dfcbcf7bbe14473350fb54a7ebc99a9d4e73` |
| `.../090-registry-read.sqlinc` | 74 | `50b299b8098ef5ab57b0cea82ff32474c743cd451c19ca68a266db3a3b9f12cc` |
| `.../README.md` | 51 | `ea484fa2ab58c6ecfec0978c4db98640b1a4c8b7a54c9f00caa42749e2b7da1d` |
| `tests/contracts/phase-02-slice-12-taxonomy-lineage-witness-parity.test.ts` | 70 | `a1051ddf612ad8af156232929778353ef1f06b7c74970e4f70c8118fb898b186` |
The `BEGIN/END TAXONOMY-LINEAGE-DDL` region of `030000` is byte-identical to the witness (parity test green; witness 37/37 in run 10).
Other test files unchanged (`000`, `010`, `020`, `030`, `040`, `080`, `populated-lineage.sql`).

### Requests to root (follow-up)

1. Promote `030000`-`030400` from `migrations-wip/taxonomy-def/`. The parity test follows the file automatically.
2. 060 #1061-1065 pass only with the governed-fix amendment staged; confirm them after promoting governed-fix (a canonical run with both).
3. Earlier requests 2, 4, 6 (stale `taxonomy_authority.sql:78` oracle, `db:types`, sec2 pinned lists) still stand. The `capability_missing` token and the new registry read add no new generated type.
