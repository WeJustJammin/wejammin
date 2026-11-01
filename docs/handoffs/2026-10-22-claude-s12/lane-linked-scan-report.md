# Lane `claude_s12_linked_scan` report — `cms.pattern.linked_update_scan` (P2-S12-AC-212, AC-213)

## Status

GREEN after the V6 follow-up (review V6 verdict PROMOTE; all seven root items closed). Final regression on the follow-up stack: 23 files / 10387 tests / 0 failing (lane suite 347 tests, `phase_02_slice_12_pattern*`, `dec193*`, `*composition*`, `*block_rules*`); Worker Vitest 112/112 in the lane directory and 708/708 across the related entrypoint, recheck, observability and event-consumer suites; tsc, eslint (`--max-warnings=0`) and prettier clean on every touched file, including the two `supabase/` lane READMEs. The first-pass run record below (runs 1-14, stack with `fix-dec193`) is kept; the follow-up runs are runs 15-24 and the V6 section.

HEAD `b16edb54a7a1b698ed8ca15b6085046d4270626e`. Root correction received mid-task: the staged stack EXCLUDES `dec208`. Stack for runs 1-14:
`pattern-updates,dec193,dec194,dec195,locale-gate,dec197,dec202,dec205,dec206,governed-recheck,block-rules,fix-dec193,linked-scan`; for the V6 follow-up (runs 15-24), per root: `pattern-updates,dec193,dec194,dec195,locale-gate,dec197,dec202,dec205,dec206,governed-recheck,block-rules,dec208,linked-scan` (`fix-dec193` is README-only and left out).
Nothing was committed, staged, stashed or pushed. No spec, no applied migration, no dec193/pattern-updates/block-rules SQL and no shared pgTAP helper was edited.
Backups (tar of the untracked originals before each edit round): scratch `orig-wip-linked-scan-235213.tar`, `orig-g2-235542.tar`, `orig-g5-*.tar`, and for the follow-up `v6/orig-v6-start-011505.tar` (taken before the first V6 edit)
(directory `/tmp/claude-1000/-home-rob-Projects-WeJammin/2663dcb2-f742-450b-97cd-0e849cede6cc/scratchpad/claude_s12_linked_scan/`).
One slip, disclosed: the two untracked shared registry files (`observability-registry.ts`, `.test.ts`) were edited before I tarred them; the exact replaced regions
are preserved verbatim in scratch `orig-registry-sections.txt`.

## Scope

DB half: `platform_api.cms_scan_linked_pattern_updates` (the job run) and `platform_api.cms_linked_scan_resolve_event` (the producer's event resolver), each with a
private SECURITY DEFINER function. Worker half: typed queue message, classifier, producer of `cms.pattern.activated.v1`, job (continuation, counter, DEC-211 ladder with
bounded jitter), processor and production wiring. Registry: `cms_pattern_linked_update_pending_total` left the unemitted list.

### Behavior implemented (each cited in the next sections)

- Candidates: the NEWEST row of each composition path that is `linked` to the activated lineage, in state `active` (or `pending_diff` waiting for an OLDER version),
  pinned to an older version than the activated one, on the CURRENT DRAFT revision of an `active` entry whose derived state (BE03b E2) is `draft`, whose content type is in
  the version's `compatibleTypeIds`. Taken in ascending entry id then bytewise path after the cursor, at most `batch` (default and maximum 500) per run, one more selected to know
  whether to continue. `nextCursor` is the opaque `<entry uuid>.<hex of the path octets>` of the last instance taken.
- Per entry in ascending id: position 0 entry row FOR UPDATE; position 3 the activated version row FOR SHARE (must still be `active`); position 4 the revision's content-type version row FOR SHARE;
  the predicates are re-read under those locks; position 5 the revision's live editorial reviews FOR UPDATE only when a row is to be written. Each qualifying head gets a copy at the next version in
  state `pending_diff`, pinned to the UNCHANGED version, `pending_pattern_version` = the activated version, position, slot, block, props, bindings, digest, parent and author unchanged; the live reviews are
  invalidated `dependency_changed` in the same transaction.
- Idempotent: an instance already waiting for the version (or a newer one) is no candidate; a re-delivery appends nothing and a long list continues from the cursor with no skip and no repeat.
- A version that is no longer `active` (superseded or retired since the event, or a draft) is a quiet `{0, 0, null}`; a version/lineage pair that names no stored version is `NOT_FOUND`;
  every malformed request is `INVALID_REQUEST`.
- Worker: the producer rereads the committed event (`cms_linked_scan_resolve_event`) and enqueues `{ patternId, patternVersionId }`; the job runs the RPC, enqueues the continuation before it acknowledges,
  increments `cms_pattern_linked_update_pending_total` by the rows appended (also when the continuation then fails, since the rows are committed), and retries 15/60/300 s with 0 to 10 % jitter.

## Files

| Path | Lines | SHA-256 | Note |
| --- | --- | --- | --- |
| `supabase/migrations-wip/linked-scan/20261022110000_cms_linked_scan_request.sql` | 112 | `97dcfdd1d815e3f052b517a5ab04bfe043f5a162ed097a9b8c60d9fedec9eab0` |  |
| `supabase/migrations-wip/linked-scan/20261022110050_cms_pattern_update_next_row_pending.sql` | 111 | `414364cfd35751bd658bf1e47543ddfe81d8806adfffd5659ed0e892e0680215` |  |
| `supabase/migrations-wip/linked-scan/20261022110100_cms_scan_linked_pattern_updates.sql` | 219 | `95ba04652a19b46d1e00a5911c97526976d95dbdfb40898c21529dc8a982e182` |  |
| `supabase/migrations-wip/linked-scan/20261022110200_cms_scan_linked_pattern_updates_api.sql` | 54 | `a8e6ad0e5373d968ea0c7cf172030e946f0c54c3ebe8faa59a5c3ee7ecb6802b` |  |
| `supabase/migrations-wip/linked-scan/20261022110300_cms_linked_scan_resolve_event.sql` | 98 | `729b39f3f9f78ca6eb145cc96b1d719053fd3aec26f447b49f1552bce848f81e` |  |
| `supabase/migrations-wip/linked-scan/README.md` | 19 | `19320700f51fbc66dca405e743f232f64f97c36ef4bb7e2734ad3f7c3b8df6a7` |  |
| `supabase/tests/phase_02_slice_12_linked_scan.sql` | 34 | `c49e9f64683caa04c1c5521e2cc7c220e2cdf35e005ed60012fdf6fdb3e118ab` |  |
| `supabase/tests/phase_02_slice_12_linked_scan/000-helpers.sqlinc` | 174 | `73361a84c46b6812c5f9f7d74091c3f1e294476b9b3731f374df9d98e903be5b` |  |
| `supabase/tests/phase_02_slice_12_linked_scan/010-world.sqlinc` | 85 | `7a1b4c51bae66538c4ff986bc505da4395f28db82826fa0b493836d9d59832dc` |  |
| `supabase/tests/phase_02_slice_12_linked_scan/020-contract.sqlinc` | 100 | `476218440b2842d8127280f1f0bb2cdb378bf93fcdde69d435958aa4e122f59a` |  |
| `supabase/tests/phase_02_slice_12_linked_scan/030-scan.sqlinc` | 175 | `8e5d15e77fb7d428865a22724f1cf0be431aacf236e8b2e4f136de585c0ce80f` |  |
| `supabase/tests/phase_02_slice_12_linked_scan/040-bounds.sqlinc` | 94 | `2577168cfd78ef708f21bf6d32b2d7b135c4e38126c4b14f73a5c25f33e3d9bf` |  |
| `supabase/tests/phase_02_slice_12_linked_scan/050-resolver.sqlinc` | 31 | `12aa3b9f363f1248b2e55b19c6480081540656690a2b3e4a9496d58090ab7ce3` |  |
| `supabase/tests/phase_02_slice_12_linked_scan/060-helper.sqlinc` | 109 | `769084ff6d3b221af708e2965bd2aa96ac37249fbc29291d87d6ccfa822a5f58` |  |
| `supabase/tests/phase_02_slice_12_linked_scan/README.md` | 26 | `5e9b984461f2e1d9070c8ebcc13a6dcd0cce12e8e5df2397bfd4ef3628c39ef1` |  |
| `apps/worker/src/cms-composition/linked-scan/README.md` | 63 | `4010ad8f8e374b0be273d9480a5e13ee0396406550077294aa0a659ff4cbaecf` |  |
| `apps/worker/src/cms-composition/linked-scan/contract.test.ts` | 204 | `adf125a6a6c26e65412e226e023f08a10d231bd3ab3d0d51c7ffead6146c28a1` |  |
| `apps/worker/src/cms-composition/linked-scan/contract.ts` | 102 | `7ecf1ae99996e30dbaf6090983ab8d812c1a6aa74c46e4c05011a399ee858e9c` |  |
| `apps/worker/src/cms-composition/linked-scan/job.test.ts` | 367 | `f43cb5dce606d1821335c2b8a1931e28d9fd5beb8ffdc7475ae80b1e29fd699f` |  |
| `apps/worker/src/cms-composition/linked-scan/job.ts` | 154 | `26ee13c5dce6039629846e24ba012d457e6fe6240cd60acc7d6f4afb358a618f` |  |
| `apps/worker/src/cms-composition/linked-scan/linked-scan.test-support.ts` | 87 | `8c5a33072b58379182b1f8587d2375b48765f9ef39922501f07b0cce74dfc039` |  |
| `apps/worker/src/cms-composition/linked-scan/message.ts` | 13 | `3127f0337677c347415621dfd75273591160edb1d8879f39312f415e8d134254` |  |
| `apps/worker/src/cms-composition/linked-scan/observability.test.ts` | 97 | `32e9b6dde30083878ae405205e04725c9c8302332680f99fa6fa13d05e1e522d` |  |
| `apps/worker/src/cms-composition/linked-scan/processor.test.ts` | 105 | `f8b886f588f7a78e5b9af670c70fefd1aa3b7d6d42a9900fb3651dd876e5c8c1` |  |
| `apps/worker/src/cms-composition/linked-scan/processor.ts` | 47 | `5858876306c00557b38cfe3262b4fc3bfb23f1d49c9c1cc7b2c91359f063db04` |  |
| `apps/worker/src/cms-composition/linked-scan/production.test.ts` | 206 | `9ba28def988edc451de6604565bc6010809e3e9bd0514457a6a8b42c1ea3fcc7` |  |
| `apps/worker/src/cms-composition/linked-scan/production.ts` | 62 | `72a462a580804432b9c865767ea4de552a6504dbddc55c9af007efac59a8cc37` |  |
| `apps/worker/src/cms-composition/linked-scan/retry.test.ts` | 84 | `68ed9f840330963c25a5ef32c73d97085121e1d137bd9a47649e9cfc40dd9a09` |  |
| `apps/worker/src/cms-composition/linked-scan/retry.ts` | 33 | `0d888a3ddf7ef39a7ee95fe06c48c70691bca0c4e6e1ed0e1dd9fbcefff43f24` |  |
| `apps/worker/src/cms-composition/linked-scan/rpc-names.ts` | 15 | `e21303177c4e396239b9322e1458f3a1c5c223b6743fbe93ab6e1e3175ecc69c` |  |
| `apps/worker/src/cms-composition/linked-scan/rpc.test.ts` | 95 | `167229dc606ab55464f56b2e6c677818094f80728a7cafe763ce4c9da5b2a966` |  |
| `apps/worker/src/cms-composition/linked-scan/rpc.ts` | 62 | `70512373decf5ca008b27c218c8bf612707ccfadbb3ec6ea31bfad3991222ef0` |  |
| `apps/worker/src/cms-composition/linked-scan/source-consumer.test.ts` | 261 | `480a606a10b6722815119e604a60bf8d781a3966cea014d30e29d2d7365c1e21` |  |
| `apps/worker/src/cms-composition/linked-scan/source-consumer.ts` | 149 | `8d43ce15ac20679c23e31812a567b2b944f82d99cb6fe2c81694bb07bdd83c8a` |  |
| `apps/worker/src/async-entrypoint.ts` | 326 | `9e49300b75b323dfd72b8b67ec6ae512ae35586a4fdc0c763eb275571c71b6ee` | ADD-only: 3 import/union/condition lines (diff below) |
| `apps/worker/src/production-async-entrypoint.ts` | 205 | `ed6d0bdfedac231f620e61e72367035ca47c5bffa89fa2bf90937f1f52446e74` | import + `recheckFor` wrap + WeakMap type |
| `apps/worker/src/async-runtime-rpc-types.ts` | 92 | `0752350c02da14a27068100727aafb9e8873240a93c966e3d8a911be73885807` | import type + `| CmsLinkedScanRpcName` |
| `apps/worker/src/cms-composition/observability-registry.ts` | 220 | `02edc81bbfcce0243fa8707f92eea942552a255423065ece9e2045ce8d935a9c` | unemitted list emptied |
| `apps/worker/src/cms-composition/observability-registry.test.ts` | 187 | `e85bd8264709f92b65315adab336c8cd955dfd7cab045f991fd81b8716b9c46f` | TEST CORRECTION (see section) |

Shared-wiring diffs (ADD-only; the working tree already carried other lanes' uncommitted edits in these files, the lines below are mine):

```
async-entrypoint.ts            + import type { LinkedScanMessage } from './cms-composition/linked-scan/contract';
                               + import { isLinkedScanJobMessage } from './cms-composition/linked-scan/message';
                               +     | LinkedScanMessage                                   (PlatformJobsQueue union)
                               +         isGovernedRecheckJobMessage(message.body) ||        (existing line gains `||`)
                               +         isLinkedScanJobMessage(message.body)
production-async-entrypoint.ts + import { createProductionLinkedScanProcessor } from './cms-composition/linked-scan/production';
                               ~ reviewRechecks WeakMap value type and recheckFor return type -> ReturnType<typeof createProductionLinkedScanProcessor>
                               ~ recheckFor: createProductionLinkedScanProcessor(env, fetchImpl, recheckOptions, <the existing governed processor>)
async-runtime-rpc-types.ts     + import type { CmsLinkedScanRpcName } from './cms-composition/linked-scan/rpc-names';
                               +   | CmsLinkedScanRpcName                                  (AsyncRpcOperation union)
observability-registry.ts      CMS_SLICE_12_UNEMITTED_METRICS = []  (was one entry, text in scratch orig-registry-sections.txt)
```

## Runs

All pgTAP runs through `lane-db-alt-staged.sh`, one run per deliberate change, in the background, never wrapped in `timeout`. TAP copies are in the scratch directory above.

| # | Log | Kind | Result |
| - | --- | ---- | ------ |
| 1 | `red1.log` | pgTAP RED | HARNESS: `pg_temp.s12pl_extra_revision` is defined in the placement suite's 050-refusals, not in its fixtures; the world file aborted at its line 41. Not feature RED. Fixed with a lane-local `s12ls_extra_revision`. |
| 2 | `red2.log` / `red2.tap` (SHA-256 prefix 66f0c53757c9d8f4) | pgTAP RED, 268 tests, no migration | 164 ok / 104 not ok; every failure the genuine missing feature (`42883` for the scan and the resolver, missing functions for posture and lock order). The 52 setup assertions pass (real patterns, 28 real placements, template, labelled fixtures). Two checks passed vacuously at RED (PUBLIC-execute count, lock-order string over NULL positions) and were hardened afterwards (`4:0`, `where at > 0`). |
| 3 | `g1.log` / `g1.tap` | pgTAP, first migrations | 214 ok / 54 not ok. Genuine defects of mine: (a) the cursor regex `{1,512}` exceeds the POSIX repetition cap of 255 (2201B on any non-null cursor); (b) schema-qualified multi-argument `pg_catalog.unnest(a, b)` does not get the unnest-in-FROM expansion (42883 at run time). Fixed. |
| 4 | `g2.log` / `g2.tap` | pgTAP | 236 ok / 2 not ok, aborted at 040 by a repetition count in the TEST's own cursor regex; the 2 failures were a second `{0,511}` in my path grammar (the table CHECK is `octet_length 1..512` and `^/[^[:cntrl:]]*$`: the 255 cap again). Fixed in migration and test. |
| 5 | `g3.log` / `g3.tap` | pgTAP | 271 ok / 1 not ok (#261: the resolver answered `{found:false}` for a real activation). |
| 6 | `g4.log` / `g4.tap` | pgTAP + diagnostic as the definer role | the definer saw the outbox row but `pair=0` for the pattern version: the definer can read `cms_pattern_versions` only inside the RPC context, and the resolver never set it (PAT-031: the context-cleared runner exposed it; the fixtures in the same transaction had held the flag open). Fixed: the private resolver sets the flag, the wrapper restores it; diagnostic removed. |
| 7 | `g5.log` / `g5.tap` SHA-256 `7439953e329a2f8e435d97d4a465205735b09459a9a25d22326648e63232781f` | pgTAP, the lane suite | **272 / 272 pass**, 0 fail. |
| 8 | `mut-<name>.log` / `.tap`, 14 runs | pgTAP mutation sweep, each run one SQL mutation of the clean scan function | all 14 killed (not-ok count; first discriminating test): `eff` (derived-state predicate, both places) 25; `compat` 5 (#147, #180); `life` 7 (#146); `cur` (current-draft predicate) 5; `older` (`<` to `<=`) 5 (#148); `limit` (drop the +1) 4 (#239, #250); `inval` 2 (#155, #157); `pend` (no rescan of older pending) 5 (#175..); `pos` (position+1) 7 (#153, #154); `target` (wrong pending version) 6 (#177..); `states` (scan retired/draft/superseded heads) 9 (#150-152); `detached` (no link-mode filter) 8 (#141); `lineage` (no lineage filter) 11; `order` (path before entry id) 11 (#241); `idemp` (drop the newest-row guard) 12. The clean file was restored byte for byte after each (`cmp` against the scratch copy). |
| 9 | `vitest-w1.json` | Worker Vitest, lane directory | 106 / 106 pass, 8 files. The Worker tests were written before the Worker code but were first executed together with it (no separate RED execution; the Worker mutation sweep is the substitute evidence). |
| 10 | `mutate.sh`, 5 runs | Worker mutation sweep | all killed: drop the counter 5 fail; no jitter 6; any event type 1; no continuation 3; ack an invalid payload 6. Originals restored (diff against `clean-worker/`). |
| 11 | `vitest-w2.json` | Worker Vitest, related | 696 / 696 pass, 59 files: `async-entrypoint*`, `production-async-entrypoint*` (including the existing `production-async-entrypoint-review-recheck`), `governed-recheck`, `linked-scan`, `observability*`, `cms-editorial/review-recheck`, `event-consumers`. |
| 12 | `tsc1.out` | `tsc -p apps/worker/tsconfig.json --noEmit` | exit 0. |
| 13 | `eslint1.out`, prettier | eslint `--max-warnings=0` and `prettier --check` on every touched file | clean (exit 0). The `governed-recheck` directory is not prettier-clean on its own; I formatted only the lane directory and my block of the registry test. |
| 14 | `final1.log` | FINAL pgTAP: the lane suite + every `phase_02_slice_12_pattern*.sql`, `dec193*`, `*composition*.sql` (22 files, separate runner arguments) | **PASS: 21 files, 9878 tests, 0 not ok** (`final2.log` / `final2.tap`, SHA-256 `da2cfc145e39d2d0289e1398b7fde266e9422fc41b5dc8d76aa8fb85d48dc184`; an earlier attempt `final1.log` failed to start with `NOTESTS` because zsh does not word-split the file list, harness only). Per file: linked_scan 272, composition_authority 19, composition_instance_guards 9, composition_instances_read 333, composition_owner_integrity 12, slice_11 e2_composition_guard 8, dec193 carry 819 / consumers 924 / diff 259 / pattern_currentness 927 / resolution 552 / security 624 / selected_roots 1203 / slot_binding 119 / snapshot 231 / writer_boundaries 154, pattern_definition 343 / placement 715 / selector 288 / update_diff 577 / updates 1490. |
| 15 | `v6/v1.log` | pgTAP, follow-up first run | harness error in my new test (a set-returning SQL function's column is not named `value`): fixed. |
| 16 | `v6/v2.log` | pgTAP | 343 ok before a second harness error (`provolatile` is a `"char"`, `text || "char"` is ambiguous): fixed. All new assertions before it passed. |
| 17 | `v6/v3.log` / `v6/v3.tap` SHA-256 `bbe23e3fec68fa45fa3cca77729a8640c898f26a88c178c7d2cf56f725cfdfc4` | pgTAP, lane suite | **345 / 345 pass** (the 272 first-pass assertions all still green, +73 new). |
| 18 | `v6/mut2-*.log` / `.tap`, 9 runs | pgTAP mutation sweep of the V6 changes | all killed: `tgt-draft` (guard on the target state narrowed to `= 'draft'`, lock-time recheck dropped) 10 not ok (#214-218 superseded, #221-223 retired, 96-98 lock anchors); `bump` (entry version +1) 2; `audit` (an audit record of the scan's own) 1; `corr` (request correlationId ignored) 2; `submitted` (`<> 'submitted'` predicate) 1; `inline` (the inline copy back) 1; `h-actor` (helper uses the actor argument) 2; `h-guard` (helper accepts any head state) 1; `h-carry` (helper keeps the head's carried_from_id) SURVIVED at first (every world head has a null source), then killed by the new `pend-carried` assertion (re-run: 1 not ok). Clean files restored byte for byte after each (`cmp` against `clean-sql2/`). |
| 19 | `v6/final3.log` / `v6/final3.tap` SHA-256 `77ff7b0af2ed62f927aed47523507f0db56adc5a74d77c4e8258c2f72e57cf64` | FINAL pgTAP, follow-up stack: the lane suite + every `phase_02_slice_12_pattern*.sql`, `dec193*`, `*composition*.sql`, `*block_rules*.sql` (23 files, separate runner arguments) | **PASS: 23 files, 10387 tests, 0 not ok.** Per file: linked_scan 347, block_rules_legacy 310, block_rules 124, composition_authority 19, composition_instance_guards 9, composition_instances_read 333, composition_owner_integrity 12, slice_11 e2_composition_guard 8, dec193 carry 819 / consumers 924 / diff 259 / pattern_currentness 927 / resolution 552 / security 624 / selected_roots 1203 / slot_binding 119 / snapshot 231 / writer_boundaries 154, pattern_definition 343 / placement 715 / selector 288 / update_diff 577 / updates 1490. The five pattern-updates suites exercise accept and detach through the patched helper. |
| 20 | `v6/vitest-w3.json` | Worker Vitest, lane directory | 112 / 112 (106 + 6 new). |
| 21 | `mutate.sh`, 7 runs | Worker mutation sweep of the six V6 survivors (plus the source consumer's `highRisk`) | all killed (1 failing test each): J1 continue on `examined === 500`; J2 no jitter on the continuation retry; J3 `highRisk` flag of the job events; J13 `highRisk` of the admission error; S3 `highRisk` of the producer events; J10 a foreign AbortSignal handed to the run; S10 the same for the event read. Originals restored (diff against `clean-worker/`). |
| 22 | `v6/vitest-w4.json` | Worker Vitest, related | 708 / 708 pass, 59 files. |
| 23 | `v6/tsc.out`, `v6/eslint.out`, prettier | tsc `--noEmit`, eslint `--max-warnings=0`, prettier `--check` | exit 0 / 0 / clean, including both `supabase/` lane READMEs (now `prettier --write`n). |

## V6 follow-up (review V6-01 .. V6-06, V6-13; root message of 2026-10-23)

1. **V6-01, one row writer.** New forward patch `supabase/migrations-wip/linked-scan/20261022110050_cms_pattern_update_next_row_pending.sql` (sorts after the helper's definition in
   `pattern-updates/20261014140550`, which I did not edit, and before the scan): an anchored, anchor-checked, reverse-checked amendment of `platform_private.cms_pattern_update_next_row`
   (the dec202/block-rules form). One anchor (`if p_action = 'detach' then select * into pinned ...`, exactly once in the installed source) gains a `'pending'` branch; the migration raises
   unless the inverse replacement restores the installed source byte for byte and every pg_proc attribute but the source is unchanged, so the accept and detach paths ARE the installed bytes.
   The `pending` branch writes exactly what the inline copy wrote: the head at the next version, `pending_diff`, pinned version unchanged, `pending_pattern_version` = `p_plan->target`, position, slot,
   block, props, bindings, digest, parent and the HEAD's `created_by` (the actor argument is ignored: a system job has none), `carried_from_id` null, `created_at = updated_at = p_now`. It refuses
   (`INVALID_REQUEST`) a missing, non-numeric, fractional, zero, oversized or not-newer target and a head that is not a linked `active`/`pending_diff` row. The scan now calls it
   (`cms_pattern_update_next_row(v_head, 'pending', {target}, null, null, null, v_now)`) and the inline copy is deleted (execute grant added to the scan's privilege closure).
   Proof of byte-equal behavior: (a) all 272 first-pass assertions stay green, including the 650-row member-by-member conformance oracle, the 546-row bound and the cursor split; (b) new `060-helper.sqlinc`
   (75 new assertions in the follow-up in total with the items below: 347 against the first pass's 272): the pending output member by member, eleven refusals, the head with a carry source, the helper's posture and closed ACL, and the DIRECT
   outputs of `accept` and `detach` (state, link mode, pin, props, detached tree, actor, digest, every other member = the head's); (c) the five `phase_02_slice_12_pattern*` suites, which drive accept and
   detach through the command, pass in run 19; (d) static check: the scan source holds no `v_new.state`, `v_new.pending_pattern_version` or `v_new := v_head`.
2. **V6-02.** `010-world` adds lineages `ls-s` (v1 placed on `sg1`, then v2 and v3 activated: v2 SUPERSEDED) and `ls-r` (v1 placed on `rt1`, v2 activated); `030-scan` scans the superseded v2 and the
   RETIRED v2 (retired through the real governed retire producer) while a linked, older-pinned, compatible draft instance exists for each, and requires `0/0/end` with every store unchanged; the control scan of the
   active v3 finds `sg1` (`1/1/end`). Mutation `tgt-draft` (guard narrowed to `draft`, lock-time `state = 'active'` removed) now fails 10 assertions.
3. **V6-03.** After run 1 (a writing run): the stores that differ between the captured before/after images are exactly composition rows, editorial reviews, one audit record and one outbox event; the entry rows are
   identical (no version bump); the one audit record is the `cms.entry.review.invalidate` of the invalidated review and the one event its `cms.entry.review-changed.v1`. Mutations `bump` and `audit` fail.
4. **V6-04.** A third live review of `iv1` is created before run 3, which now supplies `correlationId` `a9120000-0000-4000-8000-00000000c0d9`; the invalidation it causes carries that id in its outbox event
   (`outbox_events.correlation_id`) and in its audit record (`audit_events.correlation_id`), while run 1, which supplied none, used a different (fresh) one. Code path: `110100` `v_correlation := coalesce(request, cms_trigger_correlation())`
   passed to `cms_invalidate_editorial_review` -> `cms_emit_event`. Mutation `corr` fails.
5. **V6-05, derived states: partly reachable.** `submitted` (open review) and `draft` stay exercised through real fixtures; the check #66 is now exact (`... = 'draft'` in the candidate query and
   `is distinct from 'draft'` under the lock) so a predicate on any other state fails statically (mutation `submitted` killed). `approved`, `rejected`, `scheduled` and `published` are NOT reachable through real
   producers from this lane's world: the entries are the placement suite's guarded direct inserts (no content, no dependency manifest, no schema artifact), and the only repository fixtures that reach those states
   (`phase_02_slice_11_e2/000-derived-evidence.sqlinc`, `h11r_approved`) attach synthetic evidence with `alter table ... disable trigger user`, which the lane rules forbid (no forged approvals or evidence, no disabled
   triggers); no suite in the repository drives CMS-03B-05 submit / decision / publish over a real entry. The residual risk is bounded by the E2 insert guard (`20261005018060`): a wrong predicate would abort the run with
   `VALIDATION_FAILED` rather than write to a frozen revision, and `cms_revision_effective_state` has its own eight-state suite (`phase_02_slice_11_e2_composition_guard.sql`, in run 19).
6. **V6-06.** `prettier --write` on `supabase/migrations-wip/linked-scan/README.md` and `supabase/tests/phase_02_slice_12_linked_scan/README.md` (both now pass `--check`); the READMEs also name the new patch file and `060-helper`.
   Also done while the files were open: V6-07 (comment reworded to "per entry, in ascending entry id, positions 0, 3, 4, 5 in turn"), V6-08 ("no cheap producer"), V6-12 (header sentence naming the column dependencies
   `pending_pattern_version`, `carried_from_id`, `position`; `cms_linked_scan_request` added to the posture test, five functions).
7. **V6-13, Worker survivors.** J1 (a full run of exactly 500 with no cursor is finished: no continuation), J2 (jitter on the continuation-failure retry), J3 and J13 (every event is written with
   `samplingClass: 'always'` and `highRisk` exactly when the outcome is not a success, job, admission error and producer), J10 and S10 (the signal handed to the run and to the event read is the BE00 deadline
   signal: fake timers show it aborts at 15 s and not before) each have a test now and each mutant is killed (run 21). None is unobservable.

Not done (not requested, left for root): V6-09 (typing the `as never` mocks), V6-10 (keeping the `missing.length` loop over the empty unemitted list), V6-11 (shared compatibility helper), V6-14, V6-15.

## Test corrections

One. `apps/worker/src/cms-composition/observability-registry.test.ts`, last `describe` (originally pinned the unemitted list to exactly `['cms_pattern_linked_update_pending_total']` and each `missing` text longer than 40
characters). Spec basis: BE03c Observability (`cms_pattern_linked_update_pending_total` is a named Slice 12 counter) and the brief ("remove ... from the unemitted list once emitted"): the job now increments it
(`linked-scan/job.ts`, pinned by `linked-scan/observability.test.ts` and `job.test.ts`). The replacement asserts the list is `[]` and does not contain the metric. The counter is still required in
`CMS_SLICE_12_METRICS` and in `SPEC_METRICS` (untouched). The original text of both replaced regions is in scratch `orig-registry-sections.txt`.

## Spec citations (BE03c = `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md`, SHA-256 prefix 94816d47b5ade281; sections by name, current lines in brackets)

- "Linked update (diff, accept, detach)" [~1522]: payload `{ patternId, patternVersionId }`, 500 per run with a continuation cursor, idempotent; appends a `pending_diff` row pinned to the unchanged
  version carrying `pending_pattern_version` and the unchanged `position` (DEC-185) for each `linked` instance on a draft revision whose pinned version is older and whose entry type is compatible; reviewed or
  published revisions keep their pin.
- "Job transport (DEC-166, DEC-180 G9)" [~1487]: typed platform-queue message, identifiers only, idempotent on re-delivery, bounded as stated; producers use the `cms.pattern.` prefix.
- "Slice 12 lock order" [~1489-1505], row `cms.pattern.linked_update_scan` [~1503]: "the positions of a composition write, taking entries in ascending entry `id` order within a run of at most 500 instances";
  the composition-write row: 0 entry, 1 authority, 2 pin/exclusion targets, 3 pattern version rows, 4 content-type version row, 5 live editorial review rows when the write invalidates them.
- Canonical records, CompositionInstance row [~1600]: "every composition write (CMS-03C-02, CMS-03C-15, the linked-update scan, the carry-over) appends a row and invalidates the revision's live editorial review in the
  same transaction" => the scan IS a composition write that invalidates (the brief's question: yes, cited). "every other append (... the linked-update scan ...) copies the position of the row it follows".
- Event schemas [~1730, ~1738]: `cms.pattern.activated.v1` `{ patternId, patternVersionId }`, emitted after the immutable pattern switch or retirement; the linked-update scan job is one of its consumers and refetches exact versions.
- Observability [~1774]: `cms_pattern_linked_update_pending_total`.
- Testing Strategy [~1791]: "the linked-update scan (a `pending_diff` row per linked draft instance, none on reviewed or published revisions, idempotent and bounded at 500)".
- BE00 queue consumers [~550]: `max_retries = 3`, delays 15 s, 60 s, 300 s "with bounded jitter".
- Criteria `phase-2.md`: P2-S12-AC-212 [3316], P2-S12-AC-213 [3317], AC-263 (metrics).
- V6 follow-up: the dec202 / block-rules anchored-patch form (`block-rules/20261022080400`) for `110050`.
- Precedents followed: `supabase/migrations-wip/governed-recheck/` and `apps/worker/src/cms-composition/governed-recheck/` (job RPC, cursor, wrapper, producer/job/processor/production split);
  `pattern-updates/20261014140600` (lock positions 0, 3, 4, 5 and the review invalidation of a composition write); `20261014140000` (`pending_pattern_version` and its CHECK).

## Open items / BOUNDARY

There is NO missing-spec BOUNDARY stub in the code. The following are implementation decisions or spec silences, each one predicate or line to change if root rules otherwise:

1. "draft revision" (Linked update): implemented as the entry's CURRENT draft revision whose derived state is draft, on an `active` entry. Basis: CMS-03C-02 places only on the current draft, `cmsCompositionInstancesRead` lists only its
   current-head rows, CMS-03C-14/15 admit only it (`revision_not_editable` otherwise), so a pending row on any other revision could never be answered; a superseded earlier revision is also derived `draft`. The spec's
   word is "draft revision" without saying "current".
2. An instance whose head is already `pending_diff` for an OLDER version (spec silent): a newer `pending_diff` row is appended (the spec appends for every linked instance whose pinned version is older). The pending value is
   advisory (CMS-03C-14/15 target the newest active compatible version). One predicate to change: `or head.pending_pattern_version < v_target.version` (selection and re-check) to skip instead.
3. The scan does NOT bump the entry `version` and writes NO audit record or outbox event of its own (the spec's composition-write sentence names the row append and the review invalidation only); the review invalidation emits its own
   `cms.entry.review-changed.v1`. Author concurrency is protected by the per-instance `version` CAS (a scan between an author's read and accept makes the instance's expected version stale).
4. `created_by` of the appended row is the head's `created_by` (the column is `NOT NULL REFERENCES auth.users`; a system job has no actor, the job transport says so); `carried_from_id` is NULL (the accept/detach precedent R1-006).
5. A version that is not `active` when the run starts or when an entry is locked (superseded by a newer activation, retired - the retirement event shares the event type - or a draft): quiet no-op, because the newest version's own
   scan covers every instance. A version/lineage pair that matches no stored version is `NOT_FOUND`, which the Worker retries into the DLQ (a forged or corrupt message is visible).
6. Lock positions 1 (caller authority) and 2 (pin/exclusion targets) do not apply: a system job has no caller and pins nothing. Positions 0, 3, 4, 5 are taken in order per entry, entries ascending; only the static source order
   is proven here (the suite's precedent); real lock-order and deadlock behavior needs root's race module.
7. (See V6-05 above.) The suite exercises derived states `submitted` (an open review) and `draft` (including the older-live-review-beside-a-newer-invalidated-review shape, whose live review the scan invalidates). `approved`, `rejected`,
   `scheduled` and `published` cannot be constructed without forging approvals or publication evidence (lane rules: no forged approvals/evidence, no disabled triggers); the predicate is the shared derived-state function
   `cms_revision_effective_state`, covered by its own BE03b E2 suite. The candidate query and the re-check under the entry lock both call it (static check #66).
8. BE00 states no jitter number: 0 to +10 % of the base delay, never earlier than the schedule (the bound the taxonomy merge convergence records), `retry.ts`, injectable sample.
9. The cursor format `<entry uuid>.<hex of the path octets>` and the result keys `{ examined, appended, nextCursor }` are the implementation's (the spec says "a continuation cursor"). The Worker never builds or parses one.
10. A 500-instance run can hold up to 500 entry row locks in one transaction (the spec's lock row says exactly that).

## Requests to root

1. Promote `supabase/migrations-wip/linked-scan/20261022110000 .. 110300` together (all five files, `110050` included; it needs the pattern-updates definition of `cms_pattern_update_next_row` installed first), then update `supabase/tests/phase_02_slice_09_r8_api_surface.sql` (the `platform_api` inventory: two new service-role
   functions `cms_scan_linked_pattern_updates(jsonb)`, `cms_linked_scan_resolve_event(uuid)`), the generated `database.types.ts` and the PostgREST allowlists, as for the governed recheck pair.
2. Race module for the scan (root runs `*.race.mjs`): scan versus a concurrent author write (CMS-03C-02/15, revision append), scan versus activation of the next version, scan versus submit/decision on the same revision, two
   concurrent scans of the same version (the idempotency under the entry lock).
3. `apps/worker/src/cms-composition/README.md` (not in my claim) says the linked-update counter has no emitting consumer (near its line 194 area): add the `linked-scan/` directory row and drop that sentence. The directory README is
   `apps/worker/src/cms-composition/linked-scan/README.md` (mine).
4. Review decision on BOUNDARY items 1 and 2 above (current-draft reading; advancing an older pending row). Either is one predicate in `20261022110100_cms_scan_linked_pattern_updates.sql` plus the matching expectation in `030-scan.sqlinc`.
5. Tracking is yours: no acceptance box was ticked by this lane. Evidence for AC-212 and AC-213 is the TAP of run 7 and run 14 and the Vitest files above (test titles carry the criterion tags).
6. The shared Worker wiring (named above, ADD-only edits across three shared files) was made in a working tree that already carries other lanes' uncommitted edits to the same files; please include them in the integration review.
