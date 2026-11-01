# DEC-193 composition carry — TEST-only author checkpoint

Author: native `gpt-6.1-sol`, `ultra`. Worktree:
`/home/rob/.codex/worktrees/phase2-slice12/WeJammin`.

Status: **UNRUN / frozen for root review and actual RED observation**.
No runtime, parser, formatter, test, database, Docker, service, network or Git
command was run by this lane. No production/old-test file was changed. No hosted,
provider, transaction-isolation, real-gateway or externally owned acceptance claim.

## Exact claim

Six NEW paths, recorded by root in S12Dispatch before release:

1. `supabase/tests/phase_02_slice_12_dec193_carry.sql`
2. `supabase/tests/phase_02_slice_12_dec193_carry/000-fixture.sqlinc`
3. `supabase/tests/phase_02_slice_12_dec193_carry/010-append-conflict.sqlinc`
4. `supabase/tests/phase_02_slice_12_dec193_carry/020-restore.sqlinc`
5. `supabase/tests/phase_02_slice_12_dec193_carry/README.md`
6. This handoff.

Existing S09/S12 fixture helpers were read/reused, never changed. The protected
primary checkout was read-only. Static file reads/counts/hashes only; root owns
normal formatting, syntax review, locked staging, observed RED and later GREEN.

## Source authority, not prior-report inference

Locked BE03c `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md`:
`:1487,1563` newest per path, append-only histories, canonical detached snapshots;
`:1543` named-source restore, registry repin, withdrawn blocks, inactive linked
pattern, detached exception and absent compatible-template slot;
`:1545` public create/resolve/restore carry, exact position/tree, carried provenance.
BE03b `.memory/wiki/specs/be/03b-editorial-workflow-publication.md:186,193,196`
locks entry CAS, immutable revision version1 and replay semantics.

Current receiving functions read directly:
`20261005018045_cms_create_revision_derived_state.sql`,
`20261005018050_cms_resolve_conflict_derived_state.sql`,
`20261005018055_cms_restore_revision_derived_state.sql`.
Their latest bodies have no composition carry/translation. No current
`carried_from_id` column was found; the test observes JSON provenance so absence
is assertion failure, not nonexistent-column setup abort.

Root supplied a prior **1161 PASS** writer receipt
`721e2e33938ae82b3b24418de2cdd1eaa2e867947dbf02ecfd29caf2c6ab7034`.
This lane did not execute or independently adopt that as carry acceptance.

## Implemented receiving matrix

- `CC-APP001..005`: actual public ordinary append carries exactly newest active
  roots. Detached local version3 beats linked version1 and detached version2;
  retired latest `/gone` excludes its older active row. Exact literal subtree,
  nonempty binding and source positions `[0,2]`; old history immutable.
- `CC-RES001..003`: actual public stale same-field append creates the durable
  proposed ConflictRecord. Public explicit-yours resolution carries explicit
  readable base heads, commits new revision/record resolution and preserves
  original history. No manually fabricated conflict or inferred field choice.
- `CC-RST001..004`: named source differs from current draft's real linked
  target placement; restore must use source title/local tree and exact
  `[current,source]` parents, not current composition.
- `CC-RST005`: inactive linked prior pattern refuses atomically.
- `CC-RST006..007`: both plain SQL-NULL-tree detached and nonnull-tree detached
  restore despite inactive positive pattern provenance. Exact1543 exception is
  link-mode-based; no invented nonnull qualification.
- `CC-RST008`: historical `/main` cannot resolve in the bound compatible
  `/side`-only template; exact `template_incompatible`, no partial effects.
- `CC-RST009`: signed reachable-child deprecation remains restorable, repinning
  independent literal safe tuple digests. Local subtree digest excludes sibling;
  linked keep digest uses whole pinned forest, both with current lifecycle.
- `CC-RST010`: signed withdrawn child reachable only in detached tree refuses
  `migration_chain_incomplete`; root and another active row otherwise valid.
- `CC-RST011`: withdrawn pinned legacy root refuses the same typed error;
  detached inactive-pattern exception never exempts block authority.

Success controls: actual service role, exact new IDs/version1, every semantic
column plus `carried_from_id`, all old composition rows, persisted draft pointer,
entry CAS+1, exactly one revision/idempotency row, append/resolve's one effect
pair or restore's two exact documented effect pairs, and immutable
historical revisions/field values/relations. APP001/RES001/RST001/RST006/RST009 exercise
exact-key replay with identical body/replay header/no new effects and same-key
payload mismatch; append/restore stale CAS and resolve pre-resolution stale CAS
have full-row no-effects assertions.

## Fixture boundaries and proof limits

Real signed block registration/lifecycle, real compiled/governed type, real
policy registry evidence, real governed pattern versions, public placement,
detach, accept, conflicting append, resolve and restore. No policy/procedure
replacement or guard disabling.

The reused shared pattern-definition bootstrap also creates its documented
unused compiler-range clone. No carry/restore subject references that clone;
all tested entries bind the genuinely compiled/governed ordinal1 chain type.

Explicit guarded fixture-only setup: initial entry/revision/title/assignment;
one append-only nonempty-binding history row after real detach; historical
field-only current draft; a historical appended source bound to a second real
compatible template. All immutable histories are appended, never updated.
The missing-slot fixture is not schema-migration or latest-template-selection
proof. The binding fixture is not a missing public binding-edit producer claim.

The resolve case follows the explicit `baseRevision` authority named in1545 and
does not infer a policy for competing current composition edits. Pending-state
carry is intentionally not invented from an `active`-only clause. Composition
only: no term/taxonomy receiving implementation, generic protected-props,
D5/render/preflight/manifest or concurrency acceptance is asserted.

Expected RED, not observed: public success controls should reach existing
revision commands; absent carry should fail row count/provenance/tree/bindings;
missing restore block/pattern/slot checks should return a new draft instead of
typed atomic refusals. Setup failures or aborts must be repaired as fixtures
before treating any result as meaningful production RED. Root must observe the
actual complete suite before any GREEN claim/release.

## Source-only review correction checkpoint

Root independently identified the existing restore RPC's locked envelope at
`20261005018055_cms_restore_revision_derived_state.sql:515–559`, not a direct
revision DTO. Root extended Dispatch to exactly four paths: `000-fixture`,
`020-restore`, README and this report. No other carry/production file changed.

`s12cc_body` now unwraps `resource` only for stored operation `restore`; append
and resolve remain direct DTOs. The original complete envelope stays in
`s12cc_out.response`. Exact replay compares that raw original with the new raw
stored replay response, including `restoreVerification`.

Every successful restore variant now checks exact envelope keys, object
resource, complete request/registry evidence against owned source plus actual
active schema, actual registered owner/type/source/target zero-edge manifest,
and the exact eight distinct seams without requiring their array order. These
zero-edge expectations are specific to this controlled fixture, not a new API
policy. No source-versus-current, provenance, NULL-tree, digest or baseline
expectation was weakened.

RST006 and RST009 now also invoke the unchanged existing effects/history and
replay helpers, using their original recorded request. Calls occur before any
later signed lifecycle mutation. This adds per-variant exact effect counts,
old revision/value/relation preservation, full raw-envelope replay/no-effects,
same-key payload mismatch and stale-CAS atomic refusal.

Everything remains **UNRUN**. Previous unexecuted freeze receipt retained:
helper `14e01a56…`, restore `72a24c5c…`, README `7837b87a…`, report
`e8df32b8c9f5d37c052f2333359a5484c5649f56d91ebdacedf469633873097c`.

Root's subsequent registry-order finding extended the claim to
`010-append-conflict` (five owned paths). Its only code change moves the actual
signed child registration before the unchanged root registration, because root
`allowedChildren` must resolve an existing child key under
`20261002210000:68–71` / `20260902080000:1582+`. Both request inputs, combined
outcome and receipt assertions remain exact. The DTO/evidence/replay changes
above are frozen unchanged. This correction is still source-only **UNRUN**.
Prior corrected report receipt:
`6daafa0ce36d8324575109b8cd721fabc6cb73914900ba2367b9e599d740ce11`.

## Root-observed fixture isolation and correction

Root reports actual prior carry228 assertions /59 failures requiring fixture
isolation, not59 established production defects. Its four-lock same-transaction
`dec193-carry-context-plan-diagnostic.log` receipt SHA
`35dda7a068090fe3e1c0f94c1742190b78f68d70d667dbd4301b8cca350fdcfc`
shows raw empty `app.cms_rpc` yields policy false/evidence missing, while scoped
trusted true resolves the real policy/evidence. Root also observed the actual
`/gone` plan collision count1 at expanded choice path `/gone`, versus `/keep`0.

Under the existing five-path TEST claim, this author correction changes only
`000-fixture`, `010-append-conflict`, README and report;020 remains byte-identical.

- Add test-only `s12cc_policy_valid`: save prior CMS flag, call the unchanged
  real private predicate under trusted context, restore flag on normal return
  or error, rethrow original error. Replace only the private setup assertion's
  direct call. No policy projection/configuration/type or public context change.
- Replace invalid two-root setup accept with real SINGLE `/gone` accept and
  literal `[{"path":"/gone","choice":"theirs"}]`, including `/main/gone` outer
  placement. Then independently accept `/keep` without choices. Both target2;
  each uses actual request helpers to derive current entry/instance CAS, and
  each has its own success assertion. Existing keep label/key are retained.

Minimal inverse boundary is those two source deltas: remove the scoped helper
and restore its one setup call; remove the new gone request/assertion and put
gone back into the original keep batch. No inverse operation was performed.
Literal LOCAL tree, bindings, full old history, retired exclusion, positions
`[0,2]`, source-versus-base, exact restore envelope/evidence and raw replay
expectations are unchanged. No fake response/digest or history edit was added.

Root reports418 template-variable correction staged separately (latest security
624); the prior cc-slot detach42702 should not recur on its next run. This author
did not edit/stage/execute418 or independently claim that fix. Fresh carry RED
remains root-owned; this correction is **author UNRUN**, source-only.
Prior five-path report SHA:
`bbe38a93e2ec2a14930e0642e8b6b0d7bb7adb17405973a1a32e1d1b5083106e`.

## Verified TAP/source diagnosis and receiving-oracle correction

Read-only inspection verified root's corrected233-TAP receipt
`.lane-logs/alt-staged-pattern-updates+dec193-102843-644372.tap`, SHA
`480f9b61c44be6203b3d781aeb4b5138c4ea6d4edd702b838d3ceb7f09e81368`:
197 PASS /36 FAIL. No execution by this author. APP/RES composition omission
remains genuine RED; the following extra failures were test premises, not
additional production defects:

- Manifest139/172/205: test incorrectly required the persisted manifest PK to
  equal `migrationChainId`. DDL10500:30 gives the PK a generated UUID;10500:85–108
  derives the public chain UUID from the hash.18055:306–330 inserts and verifies
  by hash. BE03b1711/2009 requires the persisted scoped identity, not PK equality.
- Audit/outbox151/152,182/183,215/216: actual2 / wanted1. BE03b156/1711/2115
  requires revision-created plus restored chain evidence;18055:475–513 emits
  both pairs through `cms_emit_event`/`cfg_emit_effects`. Restore-only1 was wrong.
- Withdrawal226/230: actual VERSION_MISMATCH / OKVERSION_MISMATCH.020 sent2
  after deprecation, but03a117/235 and031304:185–215 keep the immutable block
  definition at version1 and append lifecycle events. RST010/011 refusal failures
  were not creditable until their signed withdrawn-state premise succeeds.

Root's14:46Z correction claim and14:50Z010 extension authorize only the four
carry source/docs files plus this report. Changes now frozen, **author UNRUN**:

1. Independent fixed-key JCS SHA-256 over the controlled zero-edge manifest's
   UUIDs and empty plan list, without the production JCS/chain-derive helpers.
   Check the request's independently shaped deterministic chain UUID; find the
   actual persisted row by exact hash + owner/type/source/target/[]/0/state/version,
   never by equality of generated PK and request UUID.
2. Preserve APP/RES count1 behavior. Restore keeps exactly one revision and
   reservation, exactly two audit/outbox rows, plus exact action/target/reason/
   actor/scope/correlation identities and both complete event payloads. The
   revision-created payload is only entry/revision IDs; restored payload has
   source ID, chain UUID/hash, edge0/value1/relation0 for this fixture. All old
   complete audit/outbox rows must also remain unchanged. No broad count-only2.
3. Signed withdrawal requests send immutable expectedVersion1. New checks read
   the actual latest child/root lifecycle event and require withdrawn; no
   production bypass or direct lifecycle write. Refusal/no-effects oracles stay.

All literal composition, provenance, position/gap, exact envelope, original raw
replay, source/current and privacy expectations remain intact. Fresh complete
TAP remains root-owned; this source correction is not an observed GREEN claim.

### Additional proof gaps — no test release or edits

All current placements have NULL `parent_instance_id` (40400:202–213); fixtures
preserve it. The same-revision/owner parent FK274200:11–19 means a carried child
must reference its newly carried parent, not a source-revision ID. A future
guarded coherent parent/child chain should use an insertion/position order that
requires parent remapping, run through each actual writer, and preserve old
history. Current semantic comparison would incorrectly require a nonnull parent
ID unchanged; future parent coverage must replace that with an explicit source
parent -> newly carried parent mapping check, not simply drop the comparison.

Newest-before-state is NOT wholly missing: `/gone` already has an older active
row and newest retired head; `/local` has several older active versions. Missing
adversarial direction: historical retired -> real re-placement/newest active at
the same path/position (BE03c1563), so old retired history cannot permanently
suppress the live head. A separate latest-superseded legacy-head exclusion can
extend active-head coverage if released. No pending-state policy is inferred;
pending or excluded-parent disposition remains outside this test correction.

## Frozen raw-source hashes

Static counts include final empty split line; all are below utility300/test400.

| Path suffix | Raw lines | SHA-256 |
| --- | ---: | --- |
| `phase_02_slice_12_dec193_carry.sql` | 24 | `97c02bba09a02a03703efd15dc2837217ad74bf9acf5a5457cbc1a1c5a1d1504` |
| `000-fixture.sqlinc` | 286 | `0a0a451113508acaf3abf497886976aee187b17af9011733da08d297327060d9` |
| `010-append-conflict.sqlinc` | 211 | `aa4ff1d48933aa66db3de1ce5548797dce35f9bbb90a3dbc687258e8e87081a9` |
| `020-restore.sqlinc` | 152 | `71d70c8ef70f6a025bdcfec5b9238592cd62c84672c3c6f5a977d8a0a9f8fc6d` |
| `README.md` | 100 | `fd8c829593a34207e98d67be8a43911956bfecd86e5043c0c3dd0a8ce8ae4121` |

Report hash is returned separately to avoid a self-referential receipt.
