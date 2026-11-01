# Native governed-submit checkpoint

Date: 2026-10-13. Lane: `native_s12_governed_submit`. Runtime: `gpt-6-astra` / `ultra`.
Checkout: `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`.

Status: fixture-isolated diagnostic GREEN: sixth run 48 assertions, all 48 passed.
New prerequisite #33, missing-policy #34, completed-cache #42 and revoked #44–48
pass; 00830 permission guards pass. Synthetic activation remains non-acceptance.
No acceptance criterion, depth ratio, completion signature or shared tracking edit.
All runtime releases are consumed. Main, helpers and thirteen applied migrations
remain frozen; no further DB, race, canonical validation or repair is authorized.

## Authored checks

`supabase/tests/phase_02_slice_12_governed_submit/020-idempotency.sqlinc` saves the
full local designer grant. Seven added assertions require a valid grant, completed
cached success, active-only revocation, exact `P0001`/`capability_missing`, NULL
body, unchanged effects and restoration of every saved active/date/timestamp field.
No trigger, guard or standing authority is disabled or forged.

The snapshot has complete scoped subject/review/dependency and all idempotency rows in deterministic primary-key order. Audit/outbox are count-only: in-place or count-preserving substitutions escape it.
This is scoped refusal/replay, not full atomicity/fault injection. Earlier `s12gov_snapshot` also excludes idempotency.

Draft templates use real CMS-03C-01. Both content types instead use guard-active
direct activation with synthetic approval hashes: ordinary type at
`supabase/tests/phase_02_slice_11_helpers/001-world.sqlinc:105`–122; protected type at
`supabase/tests/phase_02_slice_12_governed_submit/000-fixtures.sqlinc:85`–102.
These are policy preconditions, not review/activation proof; both need real producer
chains before integrated acceptance. DEC-188 definition versions/frozen pins stay
immutable; submission asserts separate lifecycle increment. DEC-189's CMS03C02
response ceiling does not apply here.

## Preflight

Read the ALT runner: migration realpath guard and migrations/tests/seed symlinks all resolve to Slice 12.
Locks: shared `/tmp/wejammin-quiet.lock`, exclusive `/tmp/wejammin-altdb.lock`, reset lock and outer `/tmp/wejammin-supabase-ci.lock`.
Pinned toolchain verified: Node `v22.23.1`, pnpm `11.24.0`.

QA020 SHA-256: `52292644ad086c6606e1a71e9b559f9182684847246024cb57d620de88e04f96`.
All four SQL files are below 300 lines; explicit whitespace scan found none.
Main/000 comments and the directory README were corrected to distinguish Run 6
historical missing-RPC RED from present, unaccepted migrations.

Historical pre-repair migration hashes used by the failed diagnostic:

- `20261013300790_cms_governed_authority_lock.sql`: `76db30eafbcf0ebb1ae6a79f9719e14d8b1f27bd87d72ef9c1d65b8f3f672ceb`.
- `20261013300800_cms_submit_governed_review.sql`: `94e26c7ea0e765039e6933f3a192bc87c13357135f7acdd8566aa4e6945074c3`.
- `20261013300810_cms_submit_governed_review_public.sql`: `2390275f2a46e34a3344b5bd13faebd0ef0b5d427723e77fc5dc6e75fb3b4ed4`.

## Single ALT diagnostic receipt

Invocation used `/bin/bash`, `login:false`, and
`PATH=/home/rob/.local/share/wejammin-toolchain/bin:$PATH`:

```sh
flock /tmp/wejammin-supabase-ci.lock bash docs/handoffs/2026-10-10-claude-s11/lanes/lane-db-alt.sh /home/rob/.codex/worktrees/phase2-slice12/WeJammin supabase/tests/phase_02_slice_12_governed_submit.sql
```

- Runner acquired its ALT lock at `17:02:00` and exited 2 during reset.
- First failure: `supabase/migrations/20261013300790_cms_governed_authority_lock.sql:66`,
  statement 5, `alter function platform_private.cms_lock_governed_authority(uuid, uuid, text) owner to wejammin_cms_definer`.
- Exact error: `permission denied for schema platform_private`, SQLSTATE `42501`,
  `LegacyMigrationApplyError`.
- Reset log: `.lane-logs/alt-reset-170200-3880991.log` (27,152 bytes).
- Reset log SHA-256: `9171b93af4230d449677591315bb99717821377d49da81937e77cda2f1b3125d`.
- TAP: not created. Executed assertions 0; passed 0; failed 0. No fixture setup
  controls or command assertions were reached.
- Executed main-file SHA-256: `de54ff938c51187da9c53572935015b53eb0f090d1422bc195910a1f8d40aaa7`.
- Executed fixture-file SHA-256: `7816408a5a5e1a07b009e1647f467c91c41a296cf5cd15f4d31dc91248a2c92a`.
- QA020 remains at its independently reviewed hash. The diagnostic used all three
  dispatched migration hashes above; the subsequent patch hashes are below.

## Read-only diagnosis and next boundary

00790 transfers ownership without temporarily granting the new owner schema CREATE.
Existing migrations bracket that operation with a narrow grant/revoke; for example,
`20261005018500_cms_claim_resolver_request.sql:96`–99 grants CREATE on
`platform_private`, changes function ownership, then revokes CREATE. Applying that
same bracket inside 00790's transaction is the likely minimal repair. Keep the
definer NOBYPASSRLS, fixed search path, function ACL and persistent schema privilege
boundary unchanged. Root subsequently released that permission-only patch in all
three claimed migrations; its static verification follows.

00800:274 and 00810:34 use the same unbracketed ownership transfer; these are static
follow-on candidates, not runtime failures from this run. The previously suspected
00800 `actor_id` / `subject_kind` PL/pgSQL ambiguities were not reached or reproduced.

## Permission-only patch, independently cleared

Root release: `2026-10-13T21:05:50Z`; live claim contained exactly 00790/00800/00810 plus existing test/report ownership. Failed 00790 rolled back; 00800/00810 were not reached. Historical failure evidence and pre-repair hashes are retained.

Exactly six statements were added immediately around existing `ALTER FUNCTION ... OWNER TO wejammin_cms_definer` inside each existing transaction:

| Migration | Added grant | Added revoke | Lines |
| --- | --- | --- | --- |
| 00790 | `grant create on schema platform_private to wejammin_cms_definer;` | `revoke create on schema platform_private from wejammin_cms_definer;` | 66, 68 |
| 00800 | `grant create on schema platform_private to wejammin_cms_definer;` | `revoke create on schema platform_private from wejammin_cms_definer;` | 274, 276 |
| 00810 | `grant create on schema platform_api to wejammin_cms_definer;` | `revoke create on schema platform_api from wejammin_cms_definer;` | 34, 36 |

This matches `20261003120500_cms_definer_function_ownership.sql:10`–16's documented new-owner schema CREATE requirement and narrower canonical bracket above. No CREATE remains after commit; no BYPASSRLS, superuser, body, ACL, search-path, table-privilege or ambiguity change.

New hashes:

- `20261013300790_cms_governed_authority_lock.sql` (73 lines): `8b9f294dd2983b1fdeec825e60946c1a5f3a048f284da0ff2ef687296e15d972`.
- `20261013300800_cms_submit_governed_review.sql` (280 lines): `384fe5d569b2f203b4054b21d1bb17b0c9df093ad7739a3c4d04e9a455c94a7e`.
- `20261013300810_cms_submit_governed_review_public.sql` (42 lines): `ffa033abe9dc404b1cece59559d54e9fbe379645c66afd39209f94e55aa495fb`.

Static byte check: removing only the two added lines per file reproduces historical SHA-256 exactly, including trailing newlines; all other bytes are preserved. Eight `20261013300000`–`20261013300700` hashes match pre-patch reads.
Each grant/transfer/revoke is adjacent inside BEGIN/COMMIT. All three files are below 300 lines and have no trailing whitespace.

Authoring held DB calls pending independent review and separate root retry release; these cleared for the one retry below. Both synthetic activation chains still block integrated acceptance even if the isolated diagnostic becomes green.

## Separately released ALT retry receipt

Native independent review cleared all three permission-patch hashes above and
unchanged QA020. Before execution, the lane re-read the fresh Dispatch Log and
CODEX-LANES release at `2026-10-13T21:13:12Z`; the earlier read still said no retry
and execution was held until the new record existed. ALT migrations/tests/seed
realpaths again matched Slice 12. Invocation, pinned toolchain and locks were the
same as the first diagnostic; no source edits accompanied this run.

- ALT lock acquired `17:14:38`; reset succeeded `17:15:08`; pg_prove exit 1.
- Reset log: `.lane-logs/alt-reset-171438-3972779.log` (27,425 bytes).
- Reset SHA-256: `1f143c58ec13b204947f557c9f9be711cc9bab34feb7f71fce8fede5ae6548e9`.
- TAP: `.lane-logs/alt-tap-171438-3972779.tap` (10,040 bytes).
- TAP SHA-256: `8f89f91fa9a592889ee491a5ead35f3f21ac911928547c5e3ef2a32e9893e3ad`.
- Assertions: 47 executed, 30 passed, 17 failed.
- First failing assertion: #16, `supabase/tests/phase_02_slice_12_governed_submit.sql:90`,
  “an owner-capability holder submits an existing draft template_version”. It
  observed SQLSTATE `42702`, expected `00000`. The same command's refusal checks
  #30/#37 expose the exact error: `column reference "actor_id" is ambiguous`.
- Failed assertion numbers: 16–24, 26–27, 30–31, 33, 35, 37, 41.

First cause: `20261013300800_cms_submit_governed_review.sql:128` uses
`record.actor_id = actor_id`; its RHS collides with the PL/pgSQL local declaration
at line 50. The minimum proposed repair is to unambiguously qualify or rename
that local and its references without changing the lookup predicate or function
contract. No ambiguity repair was applied. The later `subject_kind`/`subject_id`
collision candidates remain static and were not reached by this diagnostic.

QA020 control #41 failed because no successful submission/cache was created.
Consequently passing refusal/body/no-effect/restoration assertions #43–47 are not
proof that revoked authority cannot read an existing cached success. The grant
precondition, active-only mutation and exact restoration checks #40/#42/#47 passed.
Fixture controls #8–13 passed but do not establish genuine activation provenance.

All three reviewed migration hashes and QA020 hash were rechecked unchanged after
the run. The diagnostic release is consumed. No further DB, race, canonical suite,
`db:verify`, `validate`, service change or automatic repair/retry has run. Root
must separately release any next action; integrated producer-chain acceptance
remains blocked by both synthetic content-type activation prerequisites.

## Forward binding migration, authoring and independent review

Root authoring release: `2026-10-13T21:16:58Z`; fresh claims restrict migration writes
to new `supabase/migrations/20261013300820_cms_submit_governed_review_binding_fix.sql`.
Applied 00790/00800/00810 and all eight preserved Claude migrations remain read-only.

00820 replaces only existing private `(p_request jsonb) -> jsonb`. Locals/references change `actor_id`, `subject_kind`, `subject_id` to their `v_`-prefixed names.
Qualified record/review columns, INSERT lists, JSON keys/strings, order, branches, locks, SQLSTATEs, idempotency, public wrapper and fixtures remain unchanged.

- Migration SHA-256: `45f234534942279e4181b55f342bb4c8c6aa3753462c7833868c6f072ec55aff`.
- Size: 263 lines; no trailing whitespace.
- Inverse rename restores the contents between 00800's `$body$` delimiters exactly.
  Original and reconstructed body SHA-256:
  `bfb8ff46e99f9eb2b9da89bcbd69eeee4b6fddc97326b8e8e19eaf12b9c7b08e`.
- Independent static comparisons of quoted tokens, qualified target-column names
  and INSERT column lists also return equality; inverse equality alone could hide
  an accidental column rename, so these separate comparisons are required.
- The CREATE OR REPLACE declaration explicitly retains PL/pgSQL, VOLATILE,
  SECURITY DEFINER and empty search_path. There is no ALTER OWNER, GRANT or REVOKE.
- Before replacement, missing `to_regprocedure` target raises SQLSTATE `55000`.
  The migration snapshots `to_jsonb(pg_proc) - 'prosrc'` in transaction-local config
  and compares the same projection after replacement, aborting with `55000` on
  any difference. This includes OID, signature, owner, ACL, language, volatility,
  security and configuration; no metadata field besides body text is excluded.
  The pattern follows `20261013100500_cms_template_context_rpc_flag.sql`.
- BEGIN/COMMIT encloses the guards and replacement; lock/statement timeouts remain
  5 seconds / 30 seconds. These are authored checks, not executed metadata proof.
- SHA checks confirm all 11 applied migrations unchanged, including current
  00790/00800/00810 hashes in the permission-patch section. QA020 remains
  `52292644ad086c6606e1a71e9b559f9182684847246024cb57d620de88e04f96`.

At this historical authoring checkpoint independent review/runtime were held and #41 failed. Passing denial checks could not establish revoked access to an existing success; later receipts supersede it.

## Diagnostic after 00820

Root release `2026-10-13T21:24:17Z` was re-read in Dispatch Log and CODEX-LANES.
Native independent review cleared exact 00820 hash
`45f234534942279e4181b55f342bb4c8c6aa3753462c7833868c6f072ec55aff`.
All 12 migration hashes, QA020, pinned Node `v22.23.1` / pnpm `11.24.0` and ALT
realpaths were verified before the single invocation. Command and locks were
unchanged; only `phase_02_slice_12_governed_submit.sql` ran.

- ALT lock acquired `17:26:11`; reset succeeded `17:26:39`; pg_prove exit 1.
- Reset log: `.lane-logs/alt-reset-172611-4047904.log` (27,505 bytes).
- Reset SHA-256: `656ee95fa92b418f37907541a9178d7dba16d94ae91a0986650fcd06a1d93935`.
- TAP: `.lane-logs/alt-tap-172611-4047904.tap` (10,046 bytes).
- TAP SHA-256: `a8ef83d8d5d10a96dafc565e4a9372e3b38f73bb5925e7a82a6c68c9e76ce62c`.
- Assertions: 47 executed, 30 passed, 17 failed; failed numbers unchanged from the
  prior command diagnostic. First #16 at main test line 90 observes `42501`
  instead of `00000`; #30/#37 expose `permission denied for function cms_key_hash`.
- Reset applied 00820 successfully, including its before/after pg_proc-minus-prosrc
  equality guards. This proves those guards passed in this local reset only.

The direct call at 00820:112 now reaches `platform_private.cms_key_hash(text)`
under `wejammin_cms_definer`, whose execution is denied. Its exact SQL/immutable
signature and digest-only body are defined at
`20260902080000_content_schema_registry_authority.sql:219`–226; that migration's
8300–8309 loop revokes default/public and API-role execution from private CMS
helpers. The proposed minimal next repair is a new forward migration granting
EXECUTE on that exact function to `wejammin_cms_definer` only, with focused ACL
checks. No role-wide/schema-wide grant, helper body change or bypass is proposed.
No repair was applied and no additional runtime was used to inspect live ACLs.

Completed-cache control #41 still fails. Passing #43–47 does not prove denial of a
previously cached success; both synthetic active-type prerequisites also remain
diagnostic-only. All migrations and tests were left untouched during this release.
Only this report was updated; no automatic repair, retry, other DB command or AC
tick followed. Root must separately release any next work.

## Two-helper permission authoring: 00830

Fresh Dispatch Log/CODEX-LANES recorded authoring-only release `2026-10-13T21:33:54Z`:
`supabase/migrations/20261013300830_cms_governed_submit_hash_privileges.sql`.
SHA-256: `7871c43e09809b6013e47a3fe9e403e58e3160a4a7ae8a1f6b7aeab5f682f55f`.
The sole persistent delta is exactly these two explicit grants:

```sql
grant execute on function platform_private.cms_key_hash(text) to wejammin_cms_definer;
grant execute on function platform_private.cms_request_hash(jsonb) to wejammin_cms_definer;
```

Local 5s lock/30s statement timeouts remain. One DO block preflights both signatures
and grantee, rejects effective grant option, snapshots all pg_proc except proacl,
and compares ordered expanded ACLs with prior ACL UNION one non-grantable owner-to-
definer EXECUTE tuple. OID, signature, owner, source, language, security/config and
other ACL tuples must match; effective EXECUTE true/grant option false. Mismatch
raises 55000 and rolls back. Static checks: 107 lines, exactly two grants, no other
DDL/DML, twelve predecessor hashes and QA020 unchanged. Key-hash denial was runtime
proven; request-hash addition came from root's native callee review. At authoring,
runtime was held and #41 unresolved; later diagnostic receipt follows.

## Fourth diagnostic: 00830 applied

Fresh root release `2026-10-13T21:48:20Z` and native STATIC CLEAR were re-read.
Thirteen frozen migration hashes, QA020, pinned versions and all ALT realpaths
matched before the single unchanged command/lock sequence. ALT lock `17:50:55`;
reset passed `17:51:26`, including 00830's exact ACL/metadata guards; pg_prove exit 1.

- Reset `.lane-logs/alt-reset-175055-3682.log`, 27,582 bytes.
- Reset SHA `023d53664ff75f6d0a62ad5e2432fc805937c7037e0aa0b024a2cc2106eaf01a`.
- TAP `.lane-logs/alt-tap-175055-3682.tap`, 7,841 bytes.
- TAP SHA `8df0aac5e586ae11272bfa6ff7efa800e8cb17a6cb84a423a679a2398c3d30b7`.
- 47 assertions, 45 passed, 2 failed: #17 and #33. #16 succeeded (`00000`).
- First #17: actual sorted keys have `subjectId,subjectKey,subjectKind`; main:97
  expected `subjectId,subjectKind,subjectKey`. Both sets contain the identical 21
  members. This is a test-order oracle defect, not a missing response member.
- #33 remains `INVALID_REQUEST` versus expected `DEPENDENCY_UNAVAILABLE`; untouched.
- #40–47 pass, including #41 completed cached-success control, revoked `P0001` /
  `capability_missing`, no cached body, unchanged scoped effects and exact restoration.

This establishes fixture-isolated cached-success refusal, subject to count-only
audit/outbox limitations. Synthetic active types still preclude integrated proof.
All thirteen migrations are now applied/read-only. No automatic repair or retry
followed; the separate root test-only authoring release below came afterward.

## Separately released first-gate test correction

Before tokens: `activatedAt,contentHash,createdAt,decidedAt,id,invalidatedReason,lineageId,policyBasisHash,recordedDecisionCount,requiredCapabilities,requiredDecisionCount,riskClass,state,subjectHash,subjectId,subjectKind,subjectKey,subjectVersion,submittedAt,updatedAt,version`.
After tokens: `activatedAt,contentHash,createdAt,decidedAt,id,invalidatedReason,lineageId,policyBasisHash,recordedDecisionCount,requiredCapabilities,requiredDecisionCount,riskClass,state,subjectHash,subjectId,subjectKey,subjectKind,subjectVersion,submittedAt,updatedAt,version`. Only main:97 changed; no implementation, fixture, #33 or QA020 edit.
New main SHA `d0502d36c3510082e5cca28eacc941fa592aa1735946d01b6bffbf64e410aef7`.
Inverse token swap reconstructs exact prior SHA
`de54ff938c51187da9c53572935015b53eb0f090d1422bc195910a1f8d40aaa7`.
Static proof: 21 keys before/after, exact set equality; before unsorted, after
sorted and equal to fourth TAP actual. Oracle rejects all 21 single-key omission
mutations and one extra unknown key. Main remains 268 lines; no SQL rerun occurred.
Post-authoring read-back confirmed all thirteen applied migration hashes and QA020 unchanged.

## Fifth diagnostic: first gate now #33

Root release `2026-10-13T21:58:14Z` and native one-line oracle STATIC CLEAR were
re-read. All thirteen migration hashes, main `d0502d36…aef7`, QA020, pinned versions
and ALT realpaths matched. Same single command/locks: acquired `18:00:34`, reset
passed `18:01:01` including 00830 guards, pg_prove exit 1.

- Reset `.lane-logs/alt-reset-180034-66645.log`, 27,582 bytes.
- Reset SHA `023d53664ff75f6d0a62ad5e2432fc805937c7037e0aa0b024a2cc2106eaf01a`.
- TAP `.lane-logs/alt-tap-180034-66645.tap`, 7,157 bytes.
- TAP SHA `c20047593d69593690efe97e617d3b8bfcedc0f920ba10e9e52e74219a3ee6ae`.
- 47 assertions, 46 passed, 1 failed (#33): `INVALID_REQUEST` versus
  `DEPENDENCY_UNAVAILABLE`. #16/#17/#41/#43–47 pass. #33 SQLSTATE is not printed.

Read-only triage: main:252–255 mints the subject and separately looks up its new ID
and STABLE hash in the same SELECT. Mint writes ID at 000:130–135; hash reads at
000:147–155; request includes hash at 000:166–174. JSON-null hash is refused by
00820:70–72 (`P0001`/`INVALID_REQUEST`) before policy basis at :139–140. This supports
the initplan/snapshot setup hypothesis, but submitted JSON was not emitted: no
runtime NULL-hash or production checker defect is claimed. Proposed minimum:
mint in a prior statement, then assert valid ID/hash before the dependency request.
No edit or retry followed that run until the separate authoring release below.
Synthetic fixtures still prohibit integrated acceptance.

## Separately released dependency-fixture correction

Root accepted a fixture-evaluation risk, not runtime-proven NULL or a production
defect. Main SQL only changed; helper, migration and QA020 bytes are untouched.
The original fifth-run RED remains 47 assertions / 46 passed / #33 failed.

- Before: main:252–255 minted a draft and read its new ID/hash in sibling arguments
  of one SELECT. `select no_plan()` provided the previous 47-assertion plan.
- After: main:252 performs the same real CMS-03C-01 mint in its own statement;
  :253–266 adds exactly one prerequisite assertion; :267–270 builds/submits the
  request in a fresh statement. The missing-policy token and no-review checks are
  unchanged, not removed, weakened or replaced by the new control.
- The control requires the exact created draft template ID/key, caller owner,
  nonnull lowercase 64-hex stored and helper-read hashes, and exact hash equality.
  Normative source: `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md:389`
  requires owner-scoped exact version ID, draft state and equality to stored hash.
  DDL `20260927200000_cms_template_authority.sql:147`–163 defines the tested fields;
  existing real-mint/hash helpers remain at 000:106–155.
- Root clarified replacement of `no_plan()` with explicit `plan(48)` at main:33.
  All 47 existing assertions remain plus one control: exact expected total 48.
  New numbering: prerequisite #33, missing-policy #34, completed-cache #42,
  revoked-replay checks #44–48. #16/#17 are unchanged.
- New main SHA `20f696daeb1ed405be88bba9dd47cb6de95279f2399a68c9fcc2d4c3390d92a9`;
  283 lines. Inverting only these three edits restores full prior-file SHA
  `d0502d36c3510082e5cca28eacc941fa592aa1735946d01b6bffbf64e410aef7`.
- A static predicate model accepts a valid draft and rejects ten missing/mismatched
  ID, owner, key, state and hash variants. This is not SQL execution or runtime proof.
- Post-authoring hashes confirm all thirteen applied migrations and all three
  support SQL files (000/010/020, including QA020) unchanged; whitespace scan clean.

No fake activation/evidence was added. Existing synthetic type prerequisites and
count-only audit/outbox limitations remain. At this authoring checkpoint no sixth
run had occurred; independent review, fresh tracking and separate root release were
required. Those gates subsequently cleared for the single receipt below.

## Sixth diagnostic: 48/48 fixture-isolated GREEN

Root release `2026-10-13T22:09:45Z` and native independent STATIC CLEAR were re-read
in Dispatch Log/CODEX-LANES. All thirteen applied migration hashes, support
000/010/020, reviewed main SHA `20f696daeb1ed405be88bba9dd47cb6de95279f2399a68c9fcc2d4c3390d92a9`,
pinned Node `v22.23.1`/pnpm `11.24.0`, and ALT migrations/tests/seed realpaths matched.
One exact governed-target command ran with unchanged outer/quiet/ALT/reset locks.

- ALT acquired `18:12:34`; reset succeeded `18:13:02`; pg_prove exit 0.
- Reset `.lane-logs/alt-reset-181234-136231.log`, 27,582 bytes.
- Reset SHA `023d53664ff75f6d0a62ad5e2432fc805937c7037e0aa0b024a2cc2106eaf01a`.
- TAP `.lane-logs/alt-tap-181234-136231.tap`, 6,895 bytes.
- TAP SHA `a5d28aef8c709640abe957fc6f77caacca212110235297ffd74e64b6a19c2e72`.
- Explicit plan `1..48`: 48 executed, 48 passed, zero failed; no first failure.
- #16 submit and #17 exact closed 21-member response pass.
- #33 real owner-scoped draft/hash prerequisite and #34 expected
  `DEPENDENCY_UNAVAILABLE` pass; #35 confirms no review was committed.
- #41 exact valid-grant control, #42 completed cached success/stored response,
  #43 active-only revocation, #44 `P0001`, #45 `capability_missing`, #46 NULL cached
  body, #47 scoped no-effects and #48 full original grant restoration all pass.
- Reset applied 00830 and completed, proving its exact metadata/ACL guards passed
  in this local reset. Post-run hashes for all thirteen migrations and reviewed
  main/support files remained unchanged.

The separate mint/read sequence now reaches the intended policy refusal. The old
submitted JSON was never emitted, so the precise original NULL/initplan mechanism
remains an inference, not an independently observed runtime fact. Both synthetic
active-type/evidence fixtures still prevent integrated producer-chain acceptance;
audit/outbox comparisons remain count-only, not full-store atomicity proof.
No AC tick/signature, automatic repair/retry, race, other suite, service change or
additional DB call followed. Only this owned report changed; all runtime is HELD.

## Real-foundation authoring freeze — 2026-10-13T22:55Z — UNRUN

Root's write-only release is implemented and frozen for independent native review.
No seventh ALT run, database query, reset, race, canonical gate, migration edit,
acceptance tick or signature occurred. The sixth 48/48 result above remains a
historical fixture-isolated diagnostic; it does not validate this new source.

Manifest (SHA-256; paths relative to `supabase/tests/`):

| File | Lines | SHA-256 |
| --- | ---: | --- |
| `phase_02_slice_12_governed_submit.sql` | 295 | `318717a7f17bc2170f6d68994466ded43ef401b5db5ddb6e023d0436117c8253` |
| `phase_02_slice_12_governed_submit/000-fixtures.sqlinc` | 214 | `3b25ff67e2a0a9fc309b78a79e4efbf2969b5db398e058fef2860831297380c5` |
| `phase_02_slice_12_governed_submit/005-real-type-chains.sqlinc` | 173 | `d0b4d9850cc16d9994aebfd410b207284f5bd6768453e83fd95827edba2260b7` |
| `phase_02_slice_12_governed_submit/010-projection.sqlinc` (READONLY) | 48 | `e123571fa3cda70e8f5bd5c400e67e6ccd407fcb7a82a4ff6c838a4a8cc585ba` |
| `phase_02_slice_12_governed_submit/015-dependency-fault.sqlinc` | 152 | `7eaf30b07bb685e54fde6a7a877241ce806edab32f98c1dc59003886371123d5` |
| `phase_02_slice_12_governed_submit/020-idempotency.sqlinc` | 137 | `d5226e03c37825bf95591423abe2f0c6fdd611cabaede605c876444d776b9285` |
| `phase_02_slice_12_governed_submit/README.md` | 65 | `6ff451e0512001642597e5e20cd2bbcca996b0287579d72f9a167717b8a7ffaf` |

Static checks completed, not runtime acceptance:

- SQL-aware recursive statement counting across all 15 existing includes gives
  exactly 60 assertions: main 31, unchanged S10 4, unchanged h11 3, new 005 9,
  QA020 13. Plan is 60. Comments, strings and dollar-quoted function bodies are
  excluded. Includes exist, are not duplicated, and quoted bodies terminate.
- Mechanically reversing only the authorized main setup/include/plan/fault-call
  changes and three added controls reconstructs prior main SHA
  `20f696daeb1ed405be88bba9dd47cb6de95279f2399a68c9fcc2d4c3390d92a9`.
  Reversing only QA020's real-context substitution reconstructs prior SHA
  `52292644ad086c6606e1a71e9b559f9182684847246024cb57d620de88e04f96`.
  Thus all 48 original assertion bodies remain; the typed missing-policy refusal
  is unchanged. Twelve added controls are producer 8–16, fault 45–46 and role 60.
- All 13 applied `20261013300000` through `20261013300830` migration hashes match
  the previously recorded immutable manifest. All nine shared JWT/S09/S10/h11
  source includes and owned READONLY 010 match their pre-authoring hashes.
- Scoped `git diff --check` exits 0; explicit whitespace checks include new
  untracked SQL. All owned SQL stays below 300 lines. No legacy IDs, broad
  `s10_rpc_exec`, trigger disabling or synthetic approval assignment exists in
  owned 000/005/015. No production code or shared helper changed.

S09 owner initialization now precedes legacy S10/h11 setup. Those seven old
neighbor controls remain explicit legacy-only checks, not positive subject
evidence. New subjects use the initialized owner, actual CMS-03A-15 designer and
editor/specialist grants, ordinary/protected compile/dry-run/review/independent
approval/activation chains, and actual `cms_define_template`. Nine controls bind
real receipts, aggregate/event/projection/idempotency rows, exact artifact hashes,
passed dry runs, assignments/decisions, current policy and activation evidence.
Unchanged S09 local Auth/member/MFA scaffolding is NOT hosted identity proof.

Owned governed calls use SECURITY INVOKER, actual `SET LOCAL ROLE service_role`,
immediate `current_user` capture, narrow RPC-only exception diagnostics and exact
role restoration. Receipt writes remain outside the exception block. The role
control requires nine calls, three successes, and restored roles on every call.

015 validates the real fresh draft/hash/key, saves full pg_proc/OID/owner/ACL/config,
definition/comment/settings and positive evidence, replaces only prosrc with a
validated quoted UUID literal, and verifies source-only metadata equivalence.
Actual selected-NULL, different-UUID and NULL-argument probes precede the RPC;
both off-scope probes must raise exact P0001/S12GOV_FAULT_SCOPE_VIOLATION. There is
no positive fallback or body dependency on a GUC/temp object. Full ordered rows
from 21 relevant stores are captured before and after the RPC BEFORE restoration,
then the exact definition/catalog/evidence/settings/data are checked restored.
The refusal requires exact P0001, DEPENDENCY_UNAVAILABLE, literal policy DETAIL
and NULL body. Unexpected writes cannot be hidden by a deliberate savepoint abort.
Catalog/setup/snapshot/restoration errors propagate; query cancellation/assertion
failure is not caught. ON_ERROR_STOP plus connection/whole-transaction rollback
is mandatory on abort; there is no fault-time COMMIT or privilege widening.

Remaining gates: independent source/security/oracle review of this exact manifest;
then a separately recorded root release for any focused runtime diagnostic.
SQL compilation, live ACL expectations, real-chain coexistence, 60 runtime
outcomes and role/fault restoration are UNVERIFIED. Existing QA020 audit/outbox
comparisons remain count-only; only the new negative fault snapshot uses full
ordered rows. No all-store atomicity, hosted Auth/MFA, race or integrated Slice 12
acceptance claim is made. No further authoring or runtime is authorized here.
