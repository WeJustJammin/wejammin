# Native DEC-197 receiving SQL authoring checkpoint — 2026-10-16

Status: author lane STATIC-ONLY; workflow review-fixture correction UNRUN. Root
observed receiving 284 and state 62 PASS; reads ran 21 with six failures traced
to incomplete review fixtures. Migration remains WIP/unpromoted. Native lane
`native_receiving_sql_red_20261016`, exact requested `gpt-6.1-sol` / `ultra`.
Worktree: `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`.
Protected primary `/home/rob/Projects/WeJammin` was not edited.

## Scope and source contract

The original Slice 12 receiving RED claim created exactly ten paths:
two SQL entry suites, six `.sqlinc` fragments, their README, and this report.
The later GREEN claim added only the one WIP migration described below.
Those claims did not edit existing fixtures/sentinels. The later five-path claim
added one shared fixture fragment and changed its README, the two legacy suites
and this report. The current two-path correction changes only the read suite and
this report. No applied migration, schema, production source, progress,
closeout or acceptance file was edited. Contract schemas belong to their separate lane.

Governing source: `briefs/codex-dec197-receiving-contracts.md` (full locked storage
contract and native plan); BE04a `04a-navigation-routes-discovery.md:470` (exact
manifest registry), `:482` (sealed lifecycle), `:484` (manifest lifecycle entry),
`:509` (new-only security posture);
BE04c `04c-public-delivery-cache.md:345` (thirteen projection columns and indexes),
`:346` (direct/composite consumer relationships), `:353` (preserved consumer
policy/grant). These current source files govern the witnesses.

Root's normative clarification in BE04a `:484` and brief item 3 (`:24`) explicitly
requires INSERT of `ready` with null activation, followed by permitted UPDATEs
to `active` and then `superseded`. Creation and activation may share one
transaction. This is root-selected receiving integrity within DEC-197, not an
author-added publisher, writer or cross-location authority. `DR-L13`/`DR-L14`
remain unchanged and aligned with that explicit source rule.

Project rules/instructions plus implementation, TDD, testing, migration and
Supabase skills were read. The explicit authoring-only release prevents their
runtime/DB/network steps; no skill was treated as permission to cross that boundary.

## Frozen receiving witnesses and root-observed RED

| Label groups | Authored proof |
|---|---|
| `DR-W01`–`DR-W07` | Three labelled real publication VERSION rows through existing revision/review/lineage builders; complete-set JCS hash from their stored immutable publication_hash; admin-positive ready manifests and full A/B projections |
| `DR-C01`–`DR-C54` | Exact six/thirteen columns/types/nullability; private identity; keys; three projection/two manifest indexes plus one-active partial unique; closed three/seven states; validated ordered restrictive FKs; malformed hash/state/JSON, all required NULL fields, varchar bounds, valid JSON contents and seven valid projection states |
| `DR-R01`–`DR-R25` | Full positive receiver chain; missing publication/manifest/projection; independently valid B projection misused by real A rejected specifically by composite FK; restrictive projection deletion; unique identities; projection revoke/purge remains possible; pending/converged/degraded stays publication-specific |
| `DR-L01`–`DR-L28` | Increasing non-gapless ordinals; no fake initial active; ready→active→superseded; immutable identity/ordinal/hash/generation; write-once activation; reverse/skip/reactivation/delete refusals; actual one-active unique failure; injection after both replacement updates with complete row images unchanged; legal replacement and exact no-op |
| `DR-S01`–`DR-S39` | New-only ENABLE/FORCE RLS and zero policy/runtime grants; sequence/guard restrictions; actual API/CMS roles with and without forged GUC; transaction-local diagnostic grants separately reach actual RLS; original consumer policy/CMS SELECT/write guard retained |

Parameterized label groups expand to individual TAP cases. Root's second
diagnostic executed 283 assertions: 86 PASS / 197 FAIL, with both suites Wstat 0
and no SQL abort. Root classifies the failures as attributable receiving RED.
Those nine receiving test/README files remain frozen. At that RED checkpoint,
receiving GREEN had not been observed; the later root GREEN is recorded below.
Missing receiving relation access is dynamic; outcome helpers report SQLSTATE,
constraint and relevant column rather than aborting. No case is skipped.

Guard diagnostic identities are implementation choices fixed by the tests:
SQLSTATE `23514` with `route_manifest_version_transition_check`,
`route_manifest_version_immutable_check`,
`route_manifest_version_activation_immutable_check` and
`route_manifest_version_delete_check`. They identify trigger refusals, not
catalog CHECK objects or public API error codes. CHECK/unique/FK names are
resolved from actual validated catalog structure. Create the direct consumer
projection FK before the composite FK for deterministic missing-parent/delete
attribution. Reverse-state errors take precedence over simultaneous activation
clear; state-preserving activation rewrites identify the write-once guard.

The atomic failure case requires one changed old row and one changed replacement
row before the injected exception, then compares complete before/after row images.
The hash fixture checks canonical UTF8 SHA256 against production JCS over the
actual sorted three-row frozen set; it does not claim compiler completeness.
No blanket projection immutability/deletion guard is demanded.

## Bounded review correction

The separately dispatched RLS positive-input cleanup changes exactly the two
`rls-projection` inputs in `050-security.sqlinc` to `version: 2`, avoiding the
occupied A/manifest-A/en-US/public/version-1 unique identity. SQLSTATE/constraint
denial and actual RLS-message oracles remain byte-identical. All other SQL and
README files remain frozen; this report and its security-file receipt are the
only additional correction-claim edits. That correction was frozen UNRUN before
the first root diagnostic documented below.
Static reconstruction removing exactly those two version arguments reproduces
the prior security-file SHA-256
`df5047c50a78bea6b562af458adcdf16f3efb07ca1d77846cef4ea935d4dba07`.
The other eight SQL/README receipt hashes remain unchanged.

## First root diagnostic: invalid zero-test receipt

Root reports that the first promoted-only ALT reset exited 0. Both SQL entry
suites then aborted while creating `dr_fk`, before any TAP assertion, because
`010-helpers.sqlinc:97` referenced nonexistent `pg_constraint.conmatchtype`.
The PostgreSQL diagnostic specifically suggests `c.confmatchtype`. Existing log
`.lane-logs/alt-staged-none-010952-1787819.tap` records two setup errors,
`Files=2, Tests=0`, `No subtests run`, `No plan found`, and `Result: FAIL`.
Log SHA-256:
`e0e9d3df2c8100730b0ccd59f6abd532be4dd6df8a6a6b368aad9580f4fd18e4`.
This is not missing-foundation, orphan-write or cross-publication RED evidence.

The new two-path setup-correction claim changes only `conmatchtype` to
`confmatchtype` in `010-helpers.sqlinc`, plus this report and its checksum row.
Every assertion, diagnostic and other SQL/README file was preserved. That corrected
revision was frozen UNRUN until root's separately released second diagnostic.
No migration or automatic retry was authorized by that correction.
Static reconstruction reverting that single identifier reproduces prior helper
SHA-256 `6b19151afab999a51a50f263820fa17a009d3f7478ccb99206cc4d8bc2bc19f7`;
the other eight SQL/README receipt hashes remain unchanged.

## Second root diagnostic: genuine promoted-only RED

Existing receipt `.lane-logs/alt-staged-none-011413-1819107.tap` SHA-256
`8125761607a7b10c509ad57ece6fce06dc704e0e85975a48253b3ac533bb7d38`
records 283 assertions / 86 PASS / 197 FAIL, zero SQL errors and Wstat 0 in
both suites (154 and 129 assertions). `DR-W01`/`DR-W02`/`DR-W03` pass in both
suites, establishing real labelled publication fixtures and their frozen-set
hash prerequisite before receiving failures. Root accepted this as genuine RED
and separately released the bounded WIP GREEN authoring claim.

## WIP migration candidate — root-observed receiving GREEN

New file:
`supabase/migrations-wip/dec197/20261016030000_delivery_receiving_contracts.sql`.
Physical lines: 176. SHA-256:
`1117a83f72496887c6b36d100b7fa2635aa4673d699841932291967b1516f3b6`.

The candidate contains one BEGIN/COMMIT transaction: exact six-column manifest
and thirteen-column projection tables, closed state/CHECK contracts, required
keys and indexes, private positive non-cycling identity, and the one-active
partial unique index. Identity is BY DEFAULT so an ordinal rewrite reaches the
immutability guard's specified diagnostic; allocation authority is still absent
from runtime roles. The single invoker guard has an empty search_path, enforces
ready-only lifecycle entry, immutable fields, write-once activation and no DELETE,
and leaves unsupported/null state values to their CHECK/NOT NULL diagnostics.

Both new tables ENABLE/FORCE RLS with no policies. PUBLIC/API grants and every
non-owner default ACL on these new tables, their actual identity sequence and
guard function are revoked. No caller-settable GUC is read. The projection has
no blanket immutability/delete trigger, allowing valid revoke/purge once unreferenced.

Normal validated consumer ADD CONSTRAINT statements create the direct projection
FK before the composite same-publication FK, targeting the exact parent unique.
Any orphan aborts and rolls back every preceding DDL object; no backfill, deletion,
disabled guard or NOT VALID constraint is used. The existing publication FK,
consumer policy, CMS SELECT grant and consumer write guard receive no alteration.

Only this new WIP path and the existing report were edited in the GREEN claim.
All nine SQL/README witness receipt hashes remain unchanged. No delivery writer,
endpoint, pointer, consumer, role, runner registration or migration promotion was
added. No author runtime, SQL parser, formatter, test, DB, git or network operation
was run. The candidate was frozen UNRUN for root's full readback and separately
released staged ALT GREEN; upgrade/parity and old-fixture integration remained separate claims.

## Root receiving GREEN and incomplete legacy diagnostic

Root's separately released staged ALT receiving run records 284/284 PASS, no SQL
abort, in `.lane-logs/alt-staged-dec197-013132-1920381.tap`, SHA-256
`081f0402a1038e52b474fc56456ad5459da7797e3233eecafc2dd5b951108b8f`.
The migration received independent CLEAR. This is staged receiving proof, not
upgrade rollback, ordinary promoted-tree validation or Slice 11 acceptance.

The next frozen legacy diagnostic is
`.lane-logs/alt-staged-dec197-015205-2049179.tap`, SHA-256
`3f8ff71871ab2ae2b3c949388941b12fdd9253f35051fee5694a5687b0c28e21`.
State planned 53 and ran 20, with two real stale constraint-list/sentinel failures;
reads planned 18 and ran 10. Both then aborted on the real receiving projection
FK (Wstat 768 / exit 3, bad plans). This is an incomplete diagnostic, not complete
behavioral RED or GREEN. No author retry was run.

## Guarded legacy fixture cascade — UNRUN

Dispatch released exactly four fixture paths plus this report. New
`phase_02_slice_11_helpers/006-delivery-receivers.sqlinc` has no TAP assertions.
Its publication seeder uses an existing actual revision, a qualifying approved
review at the actual dependency hash, the actual dependency/version-set builders,
the review's activation-evidence hash, and the exact E3 JCS publication hash.
Ordinary INSERT leaves the real guards enabled: no raw insertion, disabled trigger
or fabricated hash. These labelled storage fixtures deliberately do not call the
append producer or add audit/outbox events; the existing real append controls
still assert exactly three publication events.

The shared receiver caches by publication VERSION UUID and variant. It never
creates a missing publication. Each pair gets its own six-column ready manifest
(private identity ordinal) and complete thirteen-column projection, using actual
publication locale/audience. The sealed hash is over the explicit registered
real version set, sorted by canonical UUID and reading immutable stored
`publication_hash`. Cache records retain that frozen input; the AFTER INSERT
probe registers the actual new publication row without rewriting prior artifacts.
No fake active manifest, pointer, delivery writer, runtime grant or compiler
completeness is claimed.

The state suite now plans 62: the obsolete sentinel is replaced by validated
ordered direct/composite FK checks including actual parent unique indexes
(`DEC197-PS-F01/F02`), genuine missing-projection and real A-to-valid-B constraint
refusals with no surviving rows (`F03`-`F06`), exact E3 hashes and complete frozen
receiver chains (`P01`-`P03`), and distinct p0/p1 manifest dimensions without
borrowing consumer versions (`P04`). All original non-obsolete behavioral and
negative oracles remain. The missing-publication probe keeps its absent UUID,
reads an already existing projection directly from the cache, and still expects
the retained publication FK specifically. No helper repairs its missing parent.

`q_row`, direct CHECK/write-guard probes and `s11_ps_probe` use legitimate
same-publication receivers. Consumer states, attempts, timestamps, versions and
tie-breaking cases are unchanged, as are canonical, lineage, audit and outbox
assertions. The read suite plans 21: its five ordered publication fixtures are
seeded through the guards; all five have distinct receivers (including unreported
ra). `DEC197-PSR-P01`-`P03` check real hashes/full frozen inputs. Its original 18
assertions remain, with the no-write snapshot additionally covering both new
receiving tables and projection versions.

No runtime, SQL parser, formatter, tests, DB, Docker, lock, network, Git or
promotion operation was run by this author. The four fixture files and this
report were frozen UNRUN for full root readback, staged regression and independent
review. All five paths are below 400 physical lines; no extraction was needed.

## Root 367-assertion diagnostic and bounded review-fixture correction

Root's next staged four-entry run is
`.lane-logs/alt-staged-dec197-021306-2202061.tap`, SHA-256
`fabab9aac3e163153ff372e3c04a0a49387015b434540f75793e99bd7461bd1e`.
It ran 367 assertions: 361 PASS / 6 FAIL, all Wstat 0 and no SQL abort.
Receiving 284/284 and state 62/62 pass. Reads 21/21 ran: test 14 records both
actual workflow calls returning P0001:INVALID_REQUEST; 15-18/20 cascade to NULL.
The five actual publication/receiver prerequisites passed. This run does not
establish successful workflow reads or closeout acceptance.

Diagnosis: the request shape is valid in promoted `cms_get_entry_workflow`.
The added narrow `h11l_review` fixture supplies the real dependency hash but
inherits `dependency_manifest = {}`. The workflow reader projects that stored
latest-review manifest (`20261005017900:181`); strict `cms_version_set_of`
rejects the missing manifest groups (`20261005017520:69-78`). This is an author
fixture-composition defect, not a stale request or receiving/production defect.

The exact two-path correction replaces only those two read-review seeds with
existing `r11r_review`, `r11_assign_now`, `r11_decide_now` seams, still using
reviewer01. The full review freezes actual content/manifest/policy/activation
evidence. Existing P01 now also requires an approved review with the actual
dependency/content/activation hashes and a version set accepted by the actual
`cms_version_set_matches_manifest`. Plan 21 and every original read/state/no-write
expectation remain unchanged. Request builders, call sites, shared helpers,
state suite, receiving tests, README and migration remain frozen.

Static reversal of exactly the review-seed block and P01 extension reconstructs
the prior full read-suite SHA-256
`6bb7bb36e616d7b9bad6bcd02f907a2f8ad23d4198d21e78bda844be6ac0c70f`.
No author runtime, tests, parser, formatter, DB, Docker, network or Git operation
was run. The correction is frozen UNRUN for root's full independent readback and
separately released four-entry 367-assertion regression.

## Static readback and limits

All include targets resolve; authored SQL files are below 400 physical lines.
Original test-authoring readback covered lexical quote/dollar-quote/parenthesis
balance, claims, labels, sizes and hashes; the WIP received manual full readback
and byte/line/hash checks only, with no parser. Author-side checks do not execute
PostgreSQL, validate pgTAP behavior, or establish candidate GREEN.

Readback SHA-256 receipt (this report's own hash is returned to the coordinator
separately, avoiding a self-referential checksum):

| Authored path under `supabase/tests/` | Physical lines | SHA-256 |
|---|---:|---|
| `phase_02_slice_11_delivery_receiving.sql` | 15 | `75d0f8e1bece8f55fae1aed9196f297972f2ca856cc2d9eec0791a1f12a88aaa` |
| `phase_02_slice_11_delivery_receiving_security.sql` | 12 | `240fe16b03597a24e6addd83071439017719a40ac4651eb5f87f85a645f78015` |
| `phase_02_slice_11_delivery_receiving/000-world.sqlinc` | 65 | `67d35f15140a0caecae416c615f307fd4048ae160fb045ac6e897e18e8a81c80` |
| `phase_02_slice_11_delivery_receiving/010-helpers.sqlinc` | 172 | `c61b3fc3995dd56629a11f0a1f7bbebf0203b7582888d2f6930c706bce2908c0` |
| `phase_02_slice_11_delivery_receiving/020-catalog.sqlinc` | 143 | `88c4f1562bbdf92c51500082cec51e988da37c81f5462cec2d8a15bd1b299131` |
| `phase_02_slice_11_delivery_receiving/030-references.sqlinc` | 94 | `87b0299f26c0c46420b8df7f232975eb36df5e412bdcf56c8bce6810299e9563` |
| `phase_02_slice_11_delivery_receiving/040-lifecycle.sqlinc` | 100 | `5a58a7883dc81e85be31a73f2ca7a9f5f071eebd61c5bd2954a012f46f194e83` |
| `phase_02_slice_11_delivery_receiving/050-security.sqlinc` | 163 | `c4a5f3ba1f2b823b837a276f1b1f11f7dcba0187f4d386d2406aa30d5b41c3b2` |
| `phase_02_slice_11_delivery_receiving/README.md` | 68 | `173ccfd8fa11af29b2db889384f1b87345f30a6ff8f4f12c403445a1b851becf` |

Current guarded legacy-fixture receipt (separate from the frozen receiving files):

| Path under `supabase/tests/` | Physical lines | SHA-256 |
|---|---:|---|
| `phase_02_slice_11_helpers/006-delivery-receivers.sqlinc` | 151 | `00d90b687d61c5e58fcbbf25d9f0f93960e07efebb45eaa3585ac4e6018ae75b` |
| `phase_02_slice_11_helpers/README.md` | 86 | `363cf53d173cad63830c6a1e64f3ee596f0d26f7fc57a98942e8974e8b75e859` |
| `phase_02_slice_11_projection_state.sql` | 348 | `3f708e25e136af6c00f15df390ef5340a429532e35e343e6c1fddf89b0ca0621` |
| `phase_02_slice_11_projection_state_reads.sql` | 161 | `eaf94eb56b22c24730754495f99dfd2efdb2b4e24a790668495c707136f3b800` |

Historical `supabase/migrations/20261010165000_cms_projection_consumer_state.sql`
still hashes to
`e9bbd0f78fd8f6240fb4e3a543ad11e51081338abcf6cbba47679b5038bfc6ec`, matching
the locked brief. Proposed
`supabase/migrations-wip/dec197/20261016030000_delivery_receiving_contracts.sql`
was absent at the original RED-authoring readback; it now exists only as the
separately released WIP candidate above, now receiving-GREEN by root's staged run.
This lane did not embed the migration body in an upgrade witness or edit it again.

No runtime, tests, SQL execution, Docker, database, advisory/CI lock, network,
git command, promotion or acceptance operation was run by this lane.
`pnpm db:verify` and `pnpm validate` remain UNRUN by this author. Root's first
invocation setup-aborted; its second observed the frozen tests' genuine RED;
its staged receiving GREEN, incomplete legacy diagnostic and full 367-assertion
diagnostic are recorded above. The current two-path read-review correction is
authored UNRUN. Actual-migration orphan rollback/parity and closeout scanner integration
remain separate claims; no result from either is asserted here.

## Coordinator continuation

Independently read back the corrected read suite and this report, then separately
release staged ALT four-entry regression under the
established serialization protocol. The migration and nine receiving witness
files remain frozen; no automatic retry or promotion follows from authoring.
The separate upgrade cluster must replay the actual migration
against labelled pre-migration orphans and prove transactional rollback. Fresh
root validation and reviewed closeout integration remain required; no S11/S13/S15
criterion or denominator is promoted by storage authoring.

No new product/architecture decision, runtime execution or externally verified
evidence was produced by this author; root's diagnostics above were read from
their existing receipts. No additional memory/tracking path was taken outside the
exact authoring claim.
