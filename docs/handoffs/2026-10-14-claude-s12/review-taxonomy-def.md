# Independent review — lane `claude_s12_taxonomy_def_sql` (staged-runner lane `taxonomy-def`)

Reviewer: independent adversarial reviewer; did not author the lane. Static review only: `sha256sum`, `grep`,
`diff`-equivalent Python over files and TAP logs. No DB runner, psql, docker or race module was invoked. No
source, test, spec or tracking file was edited; this report is the only file written.

Worktree `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`, branch `claude/phase2-slice12`, HEAD
`b16edb54a7a1b698ed8ca15b6085046d4270626e` (verified at start). Target: author report
`docs/handoffs/2026-10-14-claude-s12/lane-taxonomy-def-report.md`, six WIP migrations under
`supabase/migrations-wip/taxonomy-def/`, the suite `supabase/tests/phase_02_slice_12_taxonomy_definition.sql` and its
directory, final TAP `.lane-logs/alt-staged-taxonomy-def-021725-2109468.tap`.

## Status

COMPLETE. Verdict at the end of this file. Summary: the SQL conforms to BE03c and to the frozen Worker boundary; every
prior RED assertion is present, in order, and now passes; no oracle was weakened; the populated-table witness is a real
data-dependent proof; the cross-operation amendment (030500) uses a safe single-anchor technique and is spec-required.
Findings are minor; none blocks promotion. Root decisions required: promote 030500 or move it to the governed lane; edit
the stale oracle in `phase_02_slice_12_taxonomy_authority.sql:78`.

## 1. Claims re-verified (author report vs disk)

| Claim | Result |
| ----- | ------ |
| Report SHA-256 `a88af612…8e52b7` | matches |
| Six WIP migration SHA-256 and line counts (167/83/226/42/134/63) | all match |
| Twelve suite file SHA-256 and line counts (29/153/102/107/75/121/92/151/161/156/280/50) | all match |
| Final TAP `07a40f0a…053e6a`, 83,468 bytes; manifest `0ba88ce4…bd6b1a`, `promoted=373 wip=6` | all match |
| Runs 1–7 TAP SHA-256 (eight TAPs in `.lane-logs/`) | all eight match the report |
| Per-run WIP counts (0,0,0,5,5,5,6,6) and local times | match the eight manifests and file mtimes |
| Final run: entry plan `1..1328`, 1328 pass / 0 fail; witness plan `1..37`, 37/37; `Result: PASS`, `Files=2, Tests=1365` | verified in the TAP; zero `not ok`, zero `# SKIP`/`# TODO`, no harness abort, contiguous numbering |
| Prior RED TAP `e8622573…1d51a` plan `1..1143`, 341 pass / 802 fail | verified |
| Plan only grew; no prior assertion deleted or weakened | all 1143 RED descriptions occur in the final entry file as an in-order subsequence (multiset difference RED−FINAL = 0); 185 descriptions added (070: read matrix, 080: schema guards, and 3 new `has_function`/privilege assertions); 0 RED-pass→FINAL-fail; 802 RED-fail→all pass |
| 010/020/030/040/050 unchanged since the reviewed RED | hashes equal the RED report's manifest (020 and 040 at their post-repair hashes `1ab4f467…`, `180e6275…`) |
| Entry file: "two includes added" | reconstruction (final minus the two `\ir 070/080` lines) hashes to the RED `fad8eb53…` exactly |
| 060: "one oracle correction" with the quoted diff | reconstruction (final minus lines 25–27 and 34) hashes to the RED `4279baf4…` exactly: the change is precisely the two comment lines, `set_config('app.cms_rpc','true',true)` before and `set_config('app.cms_rpc','',true)` after one `is()`; no assertion text or expected value changed |
| 000-harness: "`read` operation, `s12td_read_request`, `s12td_attempt` added" | reconstruction (final minus line 94 and the trailing helper block) hashes to the RED `dc561224…` exactly; no prior helper modified |
| DDL region between `BEGIN/END TAXONOMY-LINEAGE-DDL` byte-equal in migration and witness, 5,750 chars | verified byte-equal |
| Run 4 failures 1061–1065 and 1067; runs 5/6 1061–1065; run 7 entry 0 failures, `taxonomy_authority` test 5 | verified in the TAPs |
| Run 5 regression attribution | verified from diagnostics: `sec2_all_schema` #6 have−want is exactly `cms_canonical_domain_registry, cms_governed_review_assignments, cms_governed_review_decisions, cms_governed_review_dependencies, cms_governed_reviews` (want−have empty; `cms_taxonomy_versions` in both); #12 and `sec2_definer_rls` #11 name only `cms_governed_activation_schedules:wejammin_cms_definer`; slice-11 aborts are `cms_pattern_versions.lifecycle_version` NULL at `phase_02_slice_11_helpers/003-registry.sqlinc:55` (pattern table, untouched by this lane); witness run-5 abort was `could not create unique index "cms_taxonomy_versions_key_version_key"` at `populated-lineage.sql:183` (the author's own fixture, since fixed) |
| All files ≤300 lines, no `TODO`, no `any` (SQL only) | verified |

## 2. Route-registry clause table

### CMS-03C-16 (BE03c:178, 215, 218–219, 401–402, 1343, 1357, 1447, 1454, 1477, 1482)

| Clause | Implemented | Tested |
| ------ | ----------- | ------ |
| `cms.taxonomy_curator` in scope, re-proved under the position-1 lock | `030200:80–83` (`cms_lock_governed_authority` FOR SHARE on person, tenures, exact grant; `cms_person_holds_capability`) | 050 `readable-not-curator`, `member-fresh-create`, `revoked-*`, `expired-*`, `restored-replay`; 010 SETUP controls |
| hidden owner/taxonomy is 404 (concealment before capability) | `030200:71–78` | 050 `hidden-existing`, `hidden-unused`, `other-owner-parent`, "same complete refusal" |
| readable taxonomy without capability is 403 | `030200:81–83` (bare `FORBIDDEN`) | 050 (see finding F1 on `reasonCode`) |
| strict JSON: exact members, no caller-controlled fields | `030200:103–109` (`cms_exact_keys`, allowed set equals the frozen Worker payload) | 040 `missing-*`, `extra-*`, `body-*` |
| canonical domain registry read (middleware column) | not a registry read: closed set hardcoded in `030000:26–46` and the table CHECK (see F3) | 030 `domain-*`, 040 `domains-*`, 080 CHECK probes |
| key + If-Match when editing a parent; absent on a first version; operand equals `expectedVersion` exactly (215) | `030200:138–154` (decoded string operand, `^[1-9][0-9]{0,18}$`, ≤2^63−1) | 040 `version-*`, `create-if-match`, `create-null-if-match`, `edit-*`; 060 operands |
| per-owner unique (key, version), E14 | `030000:129–135` | 030 `other-owner-same-key` + distinct lineages; 080 catalog assertions; witness `w-b-same-key` |
| CAS on the parent version under the row lock | `030200:157–172` (`FOR UPDATE` latest row, exact number) | 040 `future-parent`, `absent-parent`; 060 `lifecycle-not-parent`, `stale-parent`, `successor`, `third` |
| no event (activation is CMS-03C-09) | no outbox write in `030200` | 020 oracle "terms, reviews, dependencies, registry and outbox wholly untouched" on every create |
| 201 `TaxonomyVersionResource`, `draft`, no owner/authority/lifecycle counter | `030200:197–212` (13 keys exactly the contract) | 020 `s12td_created` key set; Worker `validDraft` shape read and matched |
| idempotency: key 8–128 printable ASCII, replay returns the stored resource only to a still-authorized caller, mismatch typed | `030200:91–100` + `cms_reserve` (`^[ -~]{8,128}$`), replay after steps 3–4 | 030 `flat-replay`, `changed-body`, `changed-key-path`; 040 `idempotency-*`; 050 `revoked-replay`, `expired-replay`; 060 `create-replay-after-submit`, `successor-replay`, `changed-expected-same-key` |
| validation 401: key grammar, shape, 1–64 unique type/field keys, (owner,key,version) never reused | `030200:111–134`; `030000:133` | 040 `key-*`, `shape-*`, `allowed*Keys-*`; 030 `maximum`, `minimum`, `max-key-members`; 060 "exactly one immutable row for each allocated version" |
| validation 402: 0–6 unique closed domains; unbuilt accepted at create, refused at submission with `details.domain` | `030200:135–137`; `030000:26–46`, `146–148`; `030500` | 030 `maximum` (six domains incl. five unbuilt), `domain-*`; 040 `domains-*`; 060 `submit-*` refusals + "identifies its declared domain"; 080 CHECK probes |
| DEC-188 (208): `lifecycle_version` 1 at insert, definition `version` immutable, lifecycle only via governed RPCs | `030100:30–33`, `62–72`; `030200:181–190` | 020 "independent lifecycle starts one"; 060 DEC-188 assertions after a real submit; 080 fifteen immutable-definition probes + delete |
| lineage ids (219): `taxonomy_id` = version-1 row id, `supersedes_id` parent, unique version within lineage, one active per lineage | `030000:86–148`; `030100:35–59`; `030200:177,189` | 020 "first row owns stable lineage"; 060 `successor`/`third`; 080 lineage probes and catalog; witness |
| lock order 1343: position 1 grant rows FOR SHARE; position 3 parent row FOR UPDATE; position 4 content-type version rows FOR SHARE | positions 1 and 3 taken (`030200:80`, `157–163`); position 4 not taken (see F2) | serial authority sequence in 050; no race run (root-only) |
| typed deadlock → 409 (1357) | `030300:21–26` (`deadlock_detected`, `lock_not_available` → `CONFLICT`) | not statically testable; precedent `20261013300810` |
| error tokens and DETAIL shapes match the frozen Worker | bare `INVALID_REQUEST/UNAUTHENTICATED/NOT_FOUND/FORBIDDEN/CONFLICT/IDEMPOTENCY_MISMATCH/VALIDATION_FAILED/INTERNAL_ERROR` with pointer-array DETAIL `["/member"]` | verified by reading `taxonomy-definition-response.ts:91–133`, `cms-editorial-production-errors.ts` (`codeFromRpcError`), `error-tokens.ts` TOKEN_TABLE, `violationsFromDetailText`: every token lands on the catalog code of its status; pointers `/taxonomyKey`, `/shape`, `/allowedTypeKeys`, `/allowedFieldKeys`, `/canonicalOverlapDomains` are in the Worker allowlist |
| grants (1447, 1454): SECURITY DEFINER, empty `search_path`, PUBLIC revoked, `service_role` only on the `platform_api` transport | `030200:219–224`; `030300:35–40` | 050 `browser-anon/authenticated` 42501, private-function privilege assertions, `search_path` assertion; 080 ownership; 070 "service role holds EXECUTE on both" |
| one atomic audit record | `030200:194–196` | 020 "one atomic audit row", "every preexisting audit row remains intact" |
| rate limit, deadline, no-store, CORS, CSRF | Worker (frozen), out of SQL scope | Worker tests |

### cmsTaxonomyVersionsRead (BE03c:166, 406, 1166–1169, 1447, 1480, 1482)

| Clause | Implemented | Tested |
| ------ | ----------- | ------ |
| curator in the caller's owner scope; hidden/absent vocabulary 404; no capability 403 | `030400:44–54`, `84–92` | 070 `read-not-curator`, `read-revoked`, `read-absent`, `read-other-owner`, `read-hidden-scope`, `read-successor-id`, "one complete refusal" |
| read-only; no idempotency or If-Match; strict `{ taxonomyId }` plus server context | `030400:55–63` (`cms_exact_keys`, `cms_valid_uuid` lowercase strict) | 070 `read-extra-*` (incl. `idempotencyKey`, `ifMatch`, `page`, `limit`, `cursor`), `read-id-*`, `read-body-*`; "writes no row in any store" |
| at most 50 versions, newest first, of one lineage | `030400:65–89` | 070 `read-lineage` order `["3","2","1"]`; `read-many` 52-version bound (50, first 52, last 3) |
| items are exactly `TaxonomyVersionResource` with current state | `030400:68–81` | 070 byte-equality with the create responses, current `review` state on v1, key set per item |
| ETag on page version | `pageVersion` = floor(max(`updated_at`) of the page × 10⁶) as a decimal string (`030400:97`) | 070 high-water assertion; Worker `validVersions` and `CMS_VERSION_PATTERN` accept it (16 digits ≤ 2^63−1) |
| strict private witness `{ taxonomyId, page }`, `taxonomyId` equal to the request | `030400:93–97` | 070 "strict witness members", "witness names the requested lineage"; Worker `createTaxonomyDefinitionVersionsReader` compares and unwraps |
| grants as above | `030400:124–132` | 070 `read-browser-*`, privilege and `search_path` assertions; 080 ownership |

## 3. Rulings on the four questions

**(a) 030000 refuses ambiguous legacy data with SQLSTATE 55000 — correct; witness is a real proof.** The precheck
(`030000:56–84`) refuses any `(owner_id, taxonomy_key)` group whose versions are not exactly `1..n` or that holds more
than one `active` row, before any DDL; otherwise the lineage is reconstructed deterministically (root = version-1 row,
parent = previous number) and self-checked (`108–125`) before `taxonomy_id` is made NOT NULL and the constraints added.
Renumbering is not an option (the definition number is the immutable CAS operand, DEC-188), so refusing loudly is the only
correct treatment of an interleaved two-owner key or a gap; 55000 is the precedent SQLSTATE (`20261013300000`,
`20261013100000`). The backfill UPDATE needs only `app.cms_rpc='true'` to pass `cms_write_guard` (verified:
`cms_rpc_context_valid()` is exactly `current_setting('app.cms_rpc') = 'true'`), which the DDL sets itself, so the
migration does not depend on session state a real deploy lacks. The witness (`populated-lineage.sql`) creates five real
rows through the producer, reverts the table to the legacy shape, adds legacy rows (a 3-row superseded/active/draft chain
of another owner, a version gap, a two-active pair) and a term FK'd to a producer row, proves both refusals leave the
legacy table untouched (columns absent, global unique present), then proves the migration on the populated table row by
row (lineage equality with what the producer assigned, parent pointers by number, legacy domains `[]`, global unique gone,
term FK intact, lifecycle counters untouched) and that the producer and the read work on migrated rows and the guard is
enabled again. That is data-dependent and non-vacuous. Caveat: the witness cannot cover an interleaved two-owner key
(it cannot be reproduced under the legacy global unique); that shape is refused by the same precheck that the gap case
exercises.

**(b) 030500 is a safe technique and is spec-required; promotion ordering is root's call.** The live body
(`20261013300820:151`) contains exactly one `raise exception 'canonical_source_unavailable' using errcode = 'P0001';`;
030500 asserts one occurrence, checks `prolang`/`prorettype`/`prosecdef`, compares every `pg_proc` attribute but
`prosrc` before and after (owner, ACL, config, volatility, OID), keeps owner/ACL through `CREATE OR REPLACE`, and is
idempotent via the marker `jsonb_build_object('domain'`. The injected DETAIL references `subject` (declared jsonb in the
live body) and `cms_canonical_domain_current` (already called there); it names the first declared domain whose current
provider is not `built`, in declaration order. BE03c:1314 ("`canonical_source_unavailable` (with `details.domain`)") and
1375 (CMS-03C-06: 422 with `details.reasonCode canonical_source_unavailable` and `details.domain`, DEC-180 G11) require
the member; the frozen governed Worker consumes exactly this shape (`governed-review-refusals.test.ts:92–116` uses
`'{"domain":"gear"}'`; `governed-review-response.ts:86–89` parses `details.domain` through `CanonicalDomainSchema`).
Ordering hazard for root (F5): a later governed migration that re-creates the submit body without the DETAIL silently
drops the amendment (suite 060 #1061–1065 is the only sentinel); one that changes the raise statement before 030500 runs
makes 030500 fail loudly (55000). Either promote 030500 behind every governed submit migration, or fold the DETAIL into the
governed lane's body and drop 030500.

**(c) SECURITY DEFINER callee privilege closure — closed.** Both private functions and both transports are owned by
`wejammin_cms_definer`, `search_path=''`, revoked from `public, anon, authenticated, service_role`, EXECUTE granted to
`service_role` only on the `platform_api` wrappers. Table privileges: INSERT (`030000:155`), SELECT/UPDATE (pre-existing
from `20261013300000`); the only other writer of `cms_taxonomy_versions` is the definer-owned governed submit. The new
validator `cms_canonical_domains_valid` is revoked from the API roles and granted to the definer; because it backs a table
CHECK it must be executable by every role that inserts or updates the table — today only `wejammin_cms_definer` and the
superuser, so this is closed (note for any future non-cms-definer writer). 080 derives the callee list from `prosrc` of the
five functions and asserts EXECUTE for the owner (non-vacuous: an unknown callee yields NULL → false); the GREEN run as
`service_role` → definer wrapper → definer body is the runtime proof of the transitive closure. The trigger guard
(`030100`) runs as the invoking user; inside the producer that is the definer with the RPC flag set, so its parent lookup
sees the forced-RLS table; outside an RPC context the lookup finds nothing and refuses, the safe direction.

**(d) Concurrency and atomicity — sound.** Order per writer: position-1 FOR SHARE (person, tenures, exact grant) →
capability re-proof → one `pg_advisory_xact_lock` per (owner, key) → reservation → validation → latest row FOR UPDATE → CAS →
insert/audit/complete. Two first creates of one key serialize on the advisory lock; the loser's fresh READ COMMITTED
snapshot sees the winner's row and gets `CONFLICT`. Two successor creates serialize on the advisory lock, then on the row
lock; the loser fails the CAS, and the residual `(owner, key, version)` unique violation (reachable only if a snapshot
predates the winner's row) is caught as `CONFLICT`. A revocation committed first is seen by the re-proof after the share
locks (rule 1 of the lock order); a later revocation waits. Submit takes positions 1 and 3 and no advisory lock, so no
cycle exists between create and submit; the wrapper types a residual deadlock as `CONFLICT` with nothing committed. All
writes (reservation, draft, audit, completion) are one function in one transaction; every refusal after the reservation
(validation, operand, CAS, unique violation) aborts the whole call, which the thirteen-store snapshot oracle proves for
every refusal in the suite. A same-key concurrent replay blocks on the reservation row lock and then receives the stored
response; a revoked or hidden caller never receives it (steps 3–4 precede step 6). Not covered, as the author states:
injected mid-write faults and real races (root-only).

## 4. The 060 oracle correction

Read-only harness fix, not a guard bypass. The expected value of the assertion "built-domain review freezes exactly its
real provider registry identity" is computed through `platform_private.cms_canonical_domain_current('role')`, a
SECURITY DEFINER function owned by `wejammin_cms_definer` over a forced-RLS table whose only policy is
`cms_rpc_context_valid()` (`20261013300100:60–64`); the test session is a superuser for direct table reads but the
definer function is not, so without the flag it returned no row and the oracle compared the (correct) production result to
NULL (run 4 #1067: have one `canonical_domain` dependency, want NULL). The correction sets `app.cms_rpc` for exactly one
`SELECT` (the `is()` on lines 28–33) and restores `''`, which is the steady-state value every `platform_api` wrapper
leaves behind. Nothing executes under the flag but that read; the production call (`submit-role`) completed before it;
the actual-value side reads `cms_governed_review_dependencies` directly as the superuser regardless of the flag. The
reconstruction in section 1 proves no other byte of 060 changed. Minor style note (F4): a direct superuser read of
`cms_canonical_domain_registry` would have avoided toggling a production guard GUC in the test session.

## 5. Findings

F1 `supabase/migrations-wip/taxonomy-def/20261014030200_cms_create_taxonomy_version.sql:82` and
`20261014030400_cms_list_taxonomy_versions.sql:53` — minor — the database capability refusal raises the bare token
`FORBIDDEN`, which the frozen Worker maps to 403 `TAXONOMY_FORBIDDEN` with `details: {}`; BE03c:1295 ("403 reasonCode")
and the Slice 12 typed refusals name `capability_missing`, and the governed submit raises `capability_missing`, which the
taxonomy adapter maps to 403 with `details.reasonCode` (`taxonomy-definition-response.ts:115–116`). Why it matters: only
the race path (capability revoked between the Worker's session check and the RPC) is affected, because the Worker's own
`curatorError` already answers the typed 403 in the normal path; but on that path the client loses the reason token. Fix
direction: raise `capability_missing` in both functions and correct the two RED oracles (050 `FORBIDDEN` → `capability_missing`
for the four capability cases and 070 `read-not-curator`/`read-revoked`) under the Test-corrections rule with BE03c:1295 cited;
or record the bare token as an accepted convention for the create/read family. Not blocking.

F2 `20261014030200_cms_create_taxonomy_version.sql:156–163` — minor — BE03c:1343 lists position 4 ("the content-type
version rows the definition names, FOR SHARE") for CMS-03C-16 alongside 01 and 12; the producer takes positions 1 and 3
only. The author's rationale holds: `allowedTypeKeys` are keys, not pinned ids, they are not resolved at create (the RED
suite requires a create with an unbound key to succeed, BE03c:401 does not require resolution, binding happens at submission
through `cms_governed_bound_versions`), so there is no row the create reads or pins and skipping a later position cannot
violate the order. Why it matters: it is a deviation from the letter of the lock-order table and will be re-asked at every
audit. Fix direction: root records the interpretation in BE03c:1343 (a one-clause note that CMS-03C-16 pins no content-type
row) or the author takes FOR SHARE on the owner's existing content types named by the keys; the former is the honest fix.

F3 `20261014030000_cms_taxonomy_lineage_columns.sql:26–46` — minor/informational — the route row (BE03c:178) lists
"canonical domain registry read" for CMS-03C-16, and the error matrix (1295) allows "canonical registry/RPC deadline"
502/503; the implementation never reads `cms_canonical_domain_registry` at create and validates against a hardcoded
IMMUTABLE closed set plus a table CHECK. Behaviorally equivalent today (the registry's own CHECK pins the same six
domains, DEC-135 closes the set), and the brief fixes acceptance of unbuilt domains at create, so a registry read would
decide nothing. Why it matters: a future forward migration that registers a seventh domain must also replace the validator
and CHECK, and nothing ties them together. Fix direction: a one-line comment cross-referencing
`cms_canonical_domain_registry_domain_check`, or root records that the registry read is not taken at create.

F4 `supabase/tests/phase_02_slice_12_taxonomy_definition/060-review-successor.sqlinc:27,34` — minor — the oracle fix
toggles the production guard GUC `app.cms_rpc` in the test session around one read (analysed in section 4: read-only, not
a bypass). Fix direction: none required; a direct superuser read of the registry (`select id from
platform_private.cms_canonical_domain_registry where domain = 'role' order by version desc limit 1`) would express the
same expectation without touching the guard flag.

F5 `20261014030500_cms_submit_canonical_source_detail.sql` — minor (process) — cross-operation amendment of a
governed-lane function; safe (section 3b) but with an ordering dependency: if a governed migration later re-creates
`cms_submit_governed_review` from a full body, the DETAIL is silently lost and only suite 060 #1061–1065 detects it. Fix
direction: root promotes 030500 after every governed submit migration, or the governed lane carries the DETAIL in its own
body and 030500 is dropped; keep 060 #1061–1065 as the sentinel either way.

F6 `20261014030100_cms_taxonomy_versions_lineage_guard.sql:66–72` — informational, pre-existing, outside the lane's
scope — the UPDATE path (unchanged from `20260927260000` and `20261013300000`) still admits a `state`-only change of a
`draft`/`review` row outside the governed flag (`to_jsonb(new) - 'state' - 'updated_at'` comparison), so a direct
`update … set state = 'active'` with `app.cms_rpc='true'` by a role holding table UPDATE (only `wejammin_cms_definer`
inside definer functions) is not refused by the guard; BE03c:1427 says lifecycle metadata advances only through the
governed RPCs. The new partial unique index bounds it to one active row per lineage. The 080 probes cover every column but
`state`. Not introduced by this lane and not reachable by API roles; root/governed lane may want to close it when CMS-03C-09
lands (refuse any `state` change on the UPDATE path when `app.cms_governed_lifecycle` is not set).

F7 `20261014030400_cms_list_taxonomy_versions.sql:60` — informational — `cms_valid_uuid` is lowercase- and
version-strict while the Worker's `CmsUuidSchema` (`z.uuid()`) also accepts uppercase hex and the nil/max UUIDs; such a
path value is refused by SQL as `INVALID_REQUEST` (400, "malformed path"), which is consistent, and the witness equality
cannot be fooled because SQL never answers such an id. No change needed.

No blocker, no major. No `TODO`, no boundary stub, every file under 300 lines, conventions match the named precedents
(`20261013100200` producer shape, `20261013100300` read/wrapper shape, `20261013300810` transport ACL and deadlock mapping,
`20261013300000`/`300820` anchor-amendment technique, `20261013100000` populated-lineage DDL with BEGIN/END markers).

## 6. Test quality

Non-vacuous throughout: refusal oracles gate the no-effect comparison on the exact SQLSTATE and message and compare
thirteen complete stores; success oracles assert the exact key set, persisted row, hash, lineage, audit and reservation;
replay oracles require a successful non-null original. The 080 immutable-field probes have positive controls (a fresh root
and a correct successor insert) so each refusal is proven non-blanket; the CHECK probes expect the exact 23514 message with
the live constraint name. The 070 `pageVersion` assertion recomputes the same formula as the implementation (it proves the
set and the max, not the choice of formula; the spec prescribes none). The definer-closure assertion derives the callee
list from `prosrc` and fails on an unknown callee. The witness replays the exact migration bytes. No mock, no skipped or
filtered test, no weakened oracle.

## 7. Requests to root (reviewer's recommendations)

1. Promote `20261014030000`–`030400`. Decide 030500 per F5 (promote last, or fold into the governed lane).
2. Apply the author's request 2: `supabase/tests/phase_02_slice_12_taxonomy_authority.sql:78` pins the dropped global
   constraint; the replacement name `cms_taxonomy_versions_owner_key_version_unique` resolves through `to_regclass` (the
   backing index carries the constraint name). Also `sec2_all_schema_definer_rls` #6/#12 and `sec2_definer_rls` #11 are
   governed-lane debt (five governed tables, one schedules grant), confirmed from the run-5 diagnostics.
3. Add the DDL-parity contract test the author requests (request 3); the two regions are byte-equal today.
4. Decide F1 (token) and F2 (spec note) before FE/Worker audits re-raise them.
5. `pnpm db:types` after promotion (two new `platform_api` functions, three new columns).

VERDICT: CLEAR
