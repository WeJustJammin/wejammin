# DEC-202 entry-default policy TEST handoff

Author: native gpt-6.1-sol/ultra. Status: **source frozen, UNRUN** (2026-10-18).
Worktree: `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`.
Only the five claimed paths were written. No production, old helper, other test, tracker,
prior report, migration, grant, or canonical decision changed. Root owns all execution.
No parser, formatter, lint, test, database, Docker, process, Git, or network command run.
Static byte/count/source comparisons below used filesystem reads only, not SQL execution.

## Authority and baseline

DEC-202 and approved propagation: `.memory/wiki/decisions.md:5324–5336`.
Initial-create policy/error/replay/lock/atomicity contract:
`.memory/wiki/specs/be/03b-editorial-workflow-publication.md:1721–1729,1731–1751,2085`.
Receiving checks AC286–296 remain OPEN at
`.memory/pipeline/progress/slices/phase-02-slice-12.md:3314–3324`.
Root approved the 185-line plan in `lane-codex-entry-default-template-policy-test-plan-2026-10-17.md`,
SHA256 `354014cb727713fe44e3d600b14cdcfe5155c4d5f2b08360acd27b346357b034`.

Root reports the previous real public-create cohort completed **76 / 70 PASS / 6 FAIL**:
pin/slot failures, with all least-privilege prerequisites passing. This author did not
execute that baseline; its receipt remains root-owned. The current timestamp-corrected identity is UNRUN.
The older 40-check receipt in `lane-codex-entry-default-template-red-2026-10-17.md`
is not reidentified as the 76-check baseline or the present 132-check suite.
Root's prior helper `791daa5b...` completed132: **114 PASS / 18 FAIL**, plan132, no abort;
all R/S/B/F producer/guard/direct-fault premises passed. Log read statically:
`/tmp/wejammin-native-s12-20261017.Adf0uP/entry-default-template-policy-516-contained-first.log`,
SHA256 `993531e09a6f0fe0ffde4212612c46221706d2f25f721fe603eb4fb43aea515d`.
Root classifies16 failures as the known pin/refusal behavior; S16/F18 were two extra delta failures.
Root also reports full catalog/row rollback equality, history516 and zero residual fixture rows;
this author did not repeat database checks. That historical receipt does not execute the amended helper.

## Frozen manifest

All paths below are relative to the worktree. Physical lines include the original driver comments.

| Path | Lines / bytes | SHA256 |
| --- | ---: | --- |
| `supabase/tests/phase_02_slice_12_entry_default_template.sql` | 300 / 22654 | `9ccca7470db85ab063079d199be53983632c3a177402a6ae87790cc71d97dd71` |
| `supabase/tests/phase_02_slice_12_entry_default_template/000-policy-helpers.sqlinc` | 263 / 20181 | `5baeec66bd2f41c43b1eaf601f3f308b04920892796a6dcf37352d1a55639f0e` |
| `supabase/tests/phase_02_slice_12_entry_default_template/010-policy-lifecycle.sqlinc` | 227 / 19398 | `c3bd3f828cbdceb75473ea6c0bfb0d342cc14132a325d0b3ca3f0a6f8741649c` |
| `supabase/tests/phase_02_slice_12_entry_default_template/020-policy-fault.sqlinc` | 125 / 9944 | `edf11b2ad8341f4f79e5cbd8d52dfd1b34a6f456cfc91929953ab4faff315e17` |
| `docs/handoffs/2026-10-14-claude-s12/lane-codex-entry-default-template-policy-red-2026-10-18.md` | This report; hash sent with freeze | — |

Exact driver inverse: replace its one `select plan(132);` with `select plan(76);`,
then remove the exact three new `\ir phase_02_slice_12_entry_default_template/...sqlinc` lines,
including each line's trailing LF. No other replacement, formatting or join padding.
Result is the original 297 lines / 22440 bytes, SHA256
`ca782111c89abd51930c03e018828b16654f031ab99d349821296ca41b9df938`.
The original header and all 76 assertion bodies/literals/calls remain byte-identical.

The new non-invoking adapter (`000:211–263`) reverses exactly to the original checker:
rename `s12edp_check_saved` to `s12edt_check`, insert the original
`perform pg_temp.s12edt_run(p_tag, p_title, p_actor);` immediately after its `begin`.
Static comparison found exact equality, including all twelve comparison bodies and diagnostics.
The original checker itself was not edited.

### Pre-execution independent BLOCK and comparison-only correction

Independent review, confirmed by root before any SQL execution, found that the audit actor predicate
`effect->>'actor_id' <> actor_id` could yield SQL NULL for a nullable actual actor. In the rejection `IF`,
NULL would not reject an otherwise matching appended audit row. No audit-storage mutation seam was added.
Root released only this helper's exact appended-field comparisons and this report for correction.

All remaining 31 appended-field rejection operators in `s12edp_delta` were changed from `<>` to
`is distinct from` (prior 248-line helper:158–189). This covers entry/revision IDs, creator assignment, complete outbox
and audit identities/payload/correlation, and the exact settings snapshot fields/ordinal. Existing NULL-safe
predicates remain unchanged. Both original array-cardinality `<>` comparisons, containment, filters,
ranges, literals, operands, control flow, the original76, adapter and all132 counts are unchanged.
For the old non-NULL positive inputs, distinctness and inequality have the same truth value; a missing
actual nullable field now rejects instead of falling through the `IF`. This is static semantic reasoning,
not executed mutant coverage or a newly observed runtime receipt.

Historical comparison inverse on the complete 248-line helper SHA `791daa5b...`: split on LF; on one-based lines
`158,159,167,168,169,175,176,177,178,179,180,181,182,183,184,185,186,187,189` ONLY,
replace every exact ` is distinct from ` with ` <> `, then join with LF including the original final LF.
Exactly31 replacements reproduce 248 lines / 18557 bytes and original helper SHA256
`a9b87f90e6afe101ce2537382f564fed1aaf03f4d0ac85fc7901452558e2d9ff`.
That comparison-only helper was 434 bytes larger, with no other source edit; its historical132 receipt
is separated above from the current timestamp amendment. No executed nullable-actor storage mutant is claimed.

### Timestamp oracle correction, current identity UNRUN

Source proves the previous common-field predicate wrongly equated a full stored timestamp to a parsed
millisecond response timestamp. Create stores `snapshot_time := now()` unchanged at
`20261005018040_cms_create_entry_derived_state.sql:44,320–339,356–364,395–400`, but its response uses
`auth_iso_time` at415–422. The sole formatter definition
`20260901020000_login_methods_account_merge.sql:204–216` explicitly emits literal UTC `.MS`.
Any sub-millisecond residue makes that old equality false. This is a confirmed static TEST defect;
without a predicate trace, it is not yet runtime-proven to be the SOLE cause of both extra failures.

The corrected common-field conjunction (`000:167–172`) compares each of the four canonical tables'
full `created_at` exactly to `pg_catalog.transaction_timestamp()`, and full `updated_at` exactly to
stored `created_at`. Independent expected wire text uses literal UTC
`YYYY-MM-DD"T"HH24:MI:SS.MS"Z"` formatting of that SAME full instant (`000:133–144`), not the
production formatter. All FOUR entry/revision createdAt/updatedAt strings must match it independently.
No persisted timestamp or full-row image is rounded, stripped or normalized; all other operands remain.
The allowed diagnostic (`000:159–166`) emits only controlled label/table and four booleans when the
LEGACY full-versus-wire comparison differs: legacy mismatch, stored transaction equality, complete wire
formatting equality and stored updated equality. It neither returns nor changes any predicate result;
no UUID, timestamp value, row body or secret is logged. Its legacy wire-time cast runs only after all
four wire strings match the trusted literal format, so logging cannot add a malformed-wire exception.

Exact timestamp inverse, using current263-line coordinates, in descending order:
replace170–172 with the following TWO original lines, delete159–166, delete141–144, delete133–134.
Join with LF and retain the final LF; each of the four inverse blocks was unique in static comparison.
```sql
      or (effect->>'created_at')::timestamptz is distinct from (c.response#>>'{revision,createdAt}')::timestamptz
      or effect->>'updated_at' is distinct from effect->>'created_at') then return false; end if;
```
Result:248 lines /18991 bytes, SHA256
`791daa5b6706a4e1ff7f3b782015dc785950a04a515937c824333db1d27e7b69`.
All31 NULL-safe field changes, ranges/cardinality/containment, original76 and adapter/count132 survive.
Audit Auth UUID and context-correlation expectations were NOT changed: verified Auth UUID is returned
by `20261003110100_jwt_claim_source_authority_gates.sql:19–50` and stored unchanged by
`20260901071500_platform_configuration_runtime_commands.sql:23–35`; context correlation is selected
at `20260901070000_platform_configuration_authority.sql:350–358,496–507`. No actor-to-person conversion
or allowance for extra effects was guessed. Root independent review and diagnostic rerun remain required.

## Check derivation and fixtures

`plan(132)` = original76 + R11 + S16 + B9 + F20. The extension contains 32 direct
`ok`/`is` assertions plus two calls of the unchanged twelve-comparison adapter: 32 + 24 = 56.
No availability SKIP, discarded TAP result or helper-returned fake success is used.

- R01–R11 (`010:2–76`): save the original owner's exact completed request/response/receipt;
  actual current-review-CAS `retire` of its ACTIVE T1; unchanged schema/default and live caller
  authority in both grant stores; fresh CONFLICT/empty-detail/no-resource/full-image refusal;
  exact saved-request replay preserving canonical response, replay header, full receipt and all stores;
  same-key changed business title must retain `IDEMPOTENCY_MISMATCH` and no effects.
- S01–S16 (`010:78–130`): a separate genuinely empty schema family, actual compatible S1,
  real successor/worker/review/activation with default S1, then real SAME-key S2 activation.
  S1 must be superseded while C1 remains active with the exact S1 default; S2 has a different literal slot.
  Three real producer/history controls, twelve unchanged success comparisons, one complete positive delta.
- B01–B09 (`010:132–227`): independent B0, actual approved BT review freezing B0, actual public
  schedule at least62s ahead, real B1 successor binding that exact still-scheduled BT, zero-row worker
  and activation, actual due-clock passage and public lease claim, then public execution requiring
  `blocked/dependency_changed`. Six controls precede the three fresh blocked-default refusal oracles.
- F01–F20 (`020:1–125`): exact guarded late-leaf substitution and direct target/non-target controls,
  actual propagated unexpected RPC fault, full-row rollback, exact catalog restoration, twelve
  saved-request retry comparisons, one complete positive delta, then two canonical replay/no-effect checks.

New schema chains deliberately select existing rev3/self-context (`000:113–120`), not rev1's
now-org selector paired with its older self binding. Governed template reviews continue to use
the real rev1 grant/producer already proved by the original76. No new capability/context/membership
row is fabricated. Existing labelled local Auth/membership scaffolding remains local, not hosted proof.
Template minting uses exact literal template keys, not `s12gb_successor`'s `s12ga-` prefix assumption.
Source producers: original driver:20–104,233–295;
`phase_02_slice_09_dec108/02-chain.sqlinc:18–73,163–203,234–261`;
`phase_02_slice_12_governed_activation/000-world.sqlinc:24–60,83–120,176–223`.

## Full images and lifecycle boundaries

`000:7–43,69–105` saves/restores SQL role, actual JWT/human/party/context/RPC/MFA/config/release/
request/response settings on normal and exceptional paths. Only the public create is caught in its
call subtransaction; the exact supplied request is never regenerated. Stale response headers are cleared.
Other setup statements are explicitly labelled premise captures, not public-call observations.

`000:44–62` freezes inventory with numeric OIDs and complete ordered rows of every ordinary
`platform_private.cms_*` table plus idempotency, outbox, jobs and audit. Every column and timestamp
is retained; empty tables are `[]`. No returned-ID-only filtering, hash-only comparison or count-only rollback.
Negative/replay baselines are captured AFTER legitimate lifecycle changes. Root must verify the staged
create/trigger write-store closure; any additional non-CMS write store requires an explicit test correction.

`000:129–208` preserves every old row and permits only one entry/revision/value/creator assignment,
one matching audit/outbox and one completed canonical receipt. Ownership, field definition, authored value/hash,
timestamps, actor/party/correlation, aggregate/version and exact safe payload are checked. A settings snapshot
may append only when the owner's literal empty-settings image is absent, at the independent next ordinal;
every other store must remain identical. The original twelve comparisons independently prove pin, slots,
first head/schema/creator, literal values/hash and unchanged existing metadata.

Retirement is ACTIVE-only (`20261014160200_cms_governed_retire_branch.sql:36–52`;
`20261014160100_cms_governed_retire_apply.sql:39–66,88–126`), so R runs before the independent S case.
Supersession uses actual helpers (`20261014070200_cms_governed_activation_core.sql:117–138`).
Completed replay precedes dependency validation (`20261005018040_cms_create_entry_derived_state.sql:57–78`),
while existing business/party/context hash remains unchanged (`20260930150000_cms_idempotency_business_hash.sql:27–101`).

B's combined scheduled-default fixture reached all six controls in root's historical132 run, including
the actual due-clock claim and blocked execution. The newly amended identity is not rerun. Resolver rejects only
retired/blocked (`20261002132000_cms_template_compatibility_resolver.sql:38–57`); successor binding uses it
(`20261002216000_cms_successor_template_binding.sql:296–322`). Bound active-version identity changes
(`20261013300300_cms_governed_subject_helpers.sql:212–243`) are rechecked by actual execution
(`20261014070600_cms_execute_governed_activation.sql:130–175`). Existing real block pattern:
`phase_02_slice_12_governed_schedule/050-blocked.sqlinc:1–23`.
The bounded ≤75s poll changes no stored instant and proves only due-time passage, NOT concurrency.
A failed binding, changed/cancelled review, missing schedule, wrong lease or non-blocked subject makes
B a failed premise, not a meaningful policy RED. Its request builder is separately captured so a rejected
combined fixture does not become an untyped builder abort. Nothing manufactures the missing state.

## Late-fault contract and root gates

`020:9–94` pins the existing CMS-owned/private leaf signature, owner, complete catalog/OID/ACL/comment,
empty-search-path PL/pgSQL VOLATILE/definer profile, no API-role EXECUTE, and original prosrc MD5
`d6d9e7475cb0dee1a03e4b27df3cf93a` (1228 source bytes from
`20261005017550_cms_publication_settings_snapshot.sql:76–120`). It also requires the valid S1/C1 fixture,
one exact completed201 anchor and one later direct leaf call in the actual staged create body.
E7 tail source: `20261010130000_cms_settings_write_tail_lookup.sql:52–93,168–184`.
Its position follows entry/revision/value/assignment/audit/outbox/receipt writes
(`20261005018040_cms_create_entry_derived_state.sql:319–431`). No production test hook is introduced.
Only the target owner's leaf call raises `22P02 / DEC202_TEST_LATE_E7_22P02`; the other owner's original
body remains operational. The actual public call must reach that sentinel, not an absent function or template mapping.
Definition and full catalog are restored before every TAP assertion and retry, on normal and exceptional cleanup;
an unsuccessful restoration aborts and is not relabelled. The exact saved request/key is retried, then replayed.

Root: full source review, safe owned ALT staging/runner, then actual complete132 TAP; allow the genuine
due-clock interval rather than backdating fixtures. Revalidate all premises before classifying any new RED.
An unexpected SQL abort, catalog/profile drift, setup refusal or restoration problem is a harness/precondition
failure, not the requested behavioral evidence. Wrong successful calls are observed within the enclosing
test transaction, which ends in its existing rollback; no bad durable production commit is claimed.

Still excluded: missing/hidden404 and incompatible422 real-producer coverage (conditional integrity mapping
requires a separate release), new cross-scope replay mutants, HTTP/UI rendering, hosted Auth/RLS,
nonempty relation/composition/refcount write rollback, all append/resolve/restore/locale history carry, and
the initial-create relation2 → template3 → schema4 concurrent race. Comparing empty refcount/composition
stores is a stability oracle, not positive proof those writes were reached. No acceptance gate is cleared.
