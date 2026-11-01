# Review R1 report (`claude_s12_review_r1`): pattern-updates and dec193 WIP migrations, repair-a test corrections

Reviewer: independent (did not author any reviewed file), read-only. No SQL, docker, supabase, pgTAP or race module was run by
this reviewer. One read-only Vitest invocation was run (3 witness-parity files, 9 tests, all passed). Worktree
`/home/rob/.codex/worktrees/phase2-slice12/WeJammin`, HEAD `b16edb54a7a1b698ed8ca15b6085046d4270626e`, branch `claude/phase2-slice12`.

## Verdicts

| Lane | Verdict | Blocking items |
| --- | --- | --- |
| `pattern-updates` (10 files) | PROMOTE, only together with `dec193` | none of its own; R1-005 (dead legacy helpers) is optional hygiene. Alone it would ship the pre-DEC-193 writer (silent structural adoption, 128-key detach refusal, retired-detach refusal), so it must not be promoted without `dec193`. |
| `dec193` (44 files) | FIX FIRST | R1-001 (MAJOR) needs a root/owner ruling plus a code or test change; R1-002 (MAJOR) needs an owner confirmation before the behaviour is frozen; R1-003 (file over 300 lines) is a cheap mechanical fix. |
| `repair-a` test corrections | ACCEPT all nine (H1, P1, P2, P3, D1, U1, U2, U3, U4), with the non-blocking follow-up R1-009 (the removed multi-byte row-path case) | none |

Counts by severity: BLOCKER 0, MAJOR 2, MINOR 8, NIT 4.

## Scope (files and SHA-256 of the bytes read)

54 SQL files (10 `pattern-updates`, 44 `dec193`), the dec193 README, and the repair-a report and diff. All scope WIP files are
byte-identical to the intake backup `~/.local/share/wejammin-backups/s12-dirty-20261022T052758Z.tgz` (`diff -rq` clean), so the
all-WIP pgTAP runs recorded in `lane-repair-a-report.md` (Run 3: 72 Slice 12 files, 13,988 tests, 1 load-sensitive timing failure
outside the claim) executed exactly these bytes (the newest modification time of any scope file is 2026-10-17 19:49, before every
2026-10-22 run). Hashes were re-verified unchanged at the end of the review.

```
ac79470b6509affff4c456132345dfec1f0cdabd412890ef0eaeb4acb6c3ac8f  supabase/migrations-wip/pattern-updates/20261014140000_cms_composition_instance_pending_version.sql
dc5ac6c39ece5ba76b730c928e9cd5797125140d473703d899bc0372987b8e6e  supabase/migrations-wip/pattern-updates/20261014140100_cms_pattern_update_nodes.sql
32773f926ac9691963cfb139290e94c2fafcb623b01c68494e4acb0f78abf914  supabase/migrations-wip/pattern-updates/20261014140200_cms_pattern_update_plan.sql
926c0a7d7d0e109ab40c4a6c440a96ab2a730496b0df7eb360829f97c54c24c6  supabase/migrations-wip/pattern-updates/20261014140400_cms_get_instance_update_diff.sql
9dde7629cf5a62e5d084fd9617894f02b32daedd5eaebe20955a6723ac5432a2  supabase/migrations-wip/pattern-updates/20261014140410_cms_get_instance_update_diff_public.sql
885de34d8cbc19c571d3049cf9ad759317ee538b775ce16a3f8bce28a6ccf713  supabase/migrations-wip/pattern-updates/20261014140500_cms_pattern_update_check.sql
e767b52fe96d740777e51d5eb305445904c429cc41088df9650e1e37ace956d5  supabase/migrations-wip/pattern-updates/20261014140550_cms_pattern_update_next_row.sql
1160f326cf4ba9541cdd579ccd4f6ea3b0f5c03caa0a869310c5fd3f5460b13d  supabase/migrations-wip/pattern-updates/20261014140600_cms_apply_pattern_update.sql
58339980aa933cb214f4c89eab9e6646b93713d4c47ccacf366eb6fc2c7ca4db  supabase/migrations-wip/pattern-updates/20261014140605_cms_apply_pattern_update_closure.sql
5ed9e15ec367998bf5b35a75dc795887fee61b3305bfdb6f47b3092bf229d3ba  supabase/migrations-wip/pattern-updates/20261014140610_cms_apply_pattern_update_public.sql
ac3ec91d42b72fee2e5b4420c15c8cda8a33990483d5dfad3500448d343d3371  supabase/migrations-wip/dec193/20261016040000_cms_detached_tree_storage.sql
f9065f20e67db4bfef6390d42b211f2c4cad0c9f6c5e76f4f49b432bb9e81288  supabase/migrations-wip/dec193/20261016040100_cms_pattern_diff_delta.sql
8c6dcb56a60175b5d14467ea6895bb89ac605752efe8f62be21dbd908c1b5b35  supabase/migrations-wip/dec193/20261016040200_cms_pattern_diff_plan.sql
ab38c5fae9445daa9ef8165c28a02cacedf38128f3df7509b035840f4a68f5ac  supabase/migrations-wip/dec193/20261016040300_cms_get_instance_update_diff_dec193.sql
1e53c53a565bbb1009c0b6255e2d4b80884a1cb1aca8a9bf5508c4926bb4b0c0  supabase/migrations-wip/dec193/20261016040400_cms_pattern_slot_exact.sql
f58cb800533044b6653b67a7651e459aed98b0035687786eea6b0619d85ac0e4  supabase/migrations-wip/dec193/20261016040500_cms_pattern_snapshot_expanded.sql
50087e85f14ec02d1b0896dee8fbcfafffd08e7b6b4a911dac27fe893bc22a6d  supabase/migrations-wip/dec193/20261016040600_cms_pattern_update_resolve.sql
af5e6e2b6a3d1d7b853b308130b118f79eb62882f087cfa4eca06cb4f76e75c8  supabase/migrations-wip/dec193/20261016040700_cms_pattern_root_snapshot.sql
348f294c75459b9d7602ddf91baf2cc60db06574e183d17c3f0c65a32421a46c  supabase/migrations-wip/dec193/20261016040800_cms_detached_tree_registry.sql
c605b0f4beb660c89934d59285ba9cf4fdb329ac4ddb65cf859386bdb739e577  supabase/migrations-wip/dec193/20261016040900_cms_pattern_update_plan_dec193.sql
8b7b7d30155b6410b4efd85cf4ab38a5e017a2fae2fa3e9c9b2d8d0749ed134f  supabase/migrations-wip/dec193/20261016041000_cms_pattern_update_next_row_dec193.sql
c3f44ef01dedf794fa900807a58d943c7110808ee11467422907c0e1331933d4  supabase/migrations-wip/dec193/20261016041100_cms_apply_pattern_update_dec193.sql
c0685f16f6bbee598e70c5bce531d0963a1e59548b030b450fc4494f4a4f8743  supabase/migrations-wip/dec193/20261016041200_cms_composition_instance_content.sql
72285c651a3a24539062ed9dd4ddd7722c50ec0327b265ba18ccff27a0fa5746  supabase/migrations-wip/dec193/20261016041300_cms_composition_instance_resource_dec193.sql
2e216de635a067490ecbd7c6bdf0bb32b39f0962ec5c5580fca0fd3676d50acf  supabase/migrations-wip/dec193/20261016041400_cms_pattern_update_check_expanded.sql
b1839aa58d2d69282b21be874004349a5ffb61104f7c405815cacd458766474a  supabase/migrations-wip/dec193/20261016041500_cms_pattern_update_locked_target.sql
a3d9fb27976b0c1a68416bfb645542e22d411fd3528fbaf7248f3c28e33fabb2  supabase/migrations-wip/dec193/20261016041600_cms_detached_tree_safe_props.sql
ed8bdba1128d612b4957eea69da7b7d8e89c8f2f767389ba8b70719f7fe8afd3  supabase/migrations-wip/dec193/20261016041700_cms_preflight_effective_security.sql
c43b9b3a935791b1c791176079b7249e4f2293874c184892e1021c35d7029bde  supabase/migrations-wip/dec193/20261016041800_cms_pattern_root_snapshot_template_binding.sql
c540dd5a1f9ecd04c0ee436c91ae41f94aee4f1cb06fc0be1cf223210f4eaa53  supabase/migrations-wip/dec193/20261016041900_cms_revision_comparison_dec193.sql
925719e983f5d9ccc0b01d2bbeb4a3cfadd73071586c7b7bef77cf7199c9e435  supabase/migrations-wip/dec193/20261016042000_cms_composition_carry_provenance.sql
c473b33d72491c9faa20cc7e0d551da77a7a8b4a57b687959b7aa32e4c93ab03  supabase/migrations-wip/dec193/20261016042100_cms_revision_composition_carry.sql
a714f7d22f2618ee657db5ca3a9f6cc4b7f7cdfe6659aad0110fcdf399a169b2  supabase/migrations-wip/dec193/20261016042200_cms_revision_composition_carry_rpcs.sql
10d004b6f3830c33cd646bc27c9b0639dee770b7ac0b72673b1a13c1f10e0b99  supabase/migrations-wip/dec193/20261016042300_cms_revision_effective_composition.sql
ecad7d21253acae05eea42e677fb04cacf9b65fbdbfe63f0a1776e42218ffde9  supabase/migrations-wip/dec193/20261016042400_cms_composition_dependency_manifest_dec193.sql
db3d3f797232069310987d519084d3e465ca5267429f49d4413df5381531c188  supabase/migrations-wip/dec193/20261016042500_cms_revision_render_plan_dec193.sql
6e6cfa4a58b3f027fe7155ea6adde7ad56f8bb540344a1f0136923018076974d  supabase/migrations-wip/dec193/20261016042600_cms_accessibility_composition_dec193.sql
d4eab7c4adbf2c5a53f25c78b7d06418c7c91955537ab538ddc11d7f13b97dfd  supabase/migrations-wip/dec193/20261016042900_cms_revision_comparison_pending_dec198.sql
459893d9f17be9efd1eafb860de38a1d13ae8340935bd306fbabc1867303cede  supabase/migrations-wip/dec193/20261016043400_cms_pattern_placement_roots_check.sql
0531d7ccfe20a692da764d5dc7b52d3bf4ef332f8921f127b2698d5380d91762  supabase/migrations-wip/dec193/20261016043500_cms_pattern_placement_selected_plan.sql
f0e25950bc079833cf15347b2eddc64d7db547e725ddc926e2b533581fe0a94b  supabase/migrations-wip/dec193/20261016043600_cms_pattern_placement_path_allocation.sql
0928d377f6d46b1ba010c2f1aa64dad36e6c3bb07e8e90a8b1fa443c1917a558  supabase/migrations-wip/dec193/20261016043700_cms_insert_pattern_selected_roots.sql
9f19f42e1ef91c5913aa306614ddc2a9c77543b89be2c9e896358c8905105a42  supabase/migrations-wip/dec193/20261016044000_cms_pattern_registry_digest_readonly.sql
5793e3e4841cc086cad2f6ccf9ecc68e83751f2b3c5b73b3d9a69d479ba3be0c  supabase/migrations-wip/dec193/20261016044100_cms_pattern_live_pin_reason.sql
db89e9880b7d4a2271cd7579f7f74ddc0abcf866aca60aea9c26e6704022b8d8  supabase/migrations-wip/dec193/20261016044200_cms_pattern_active_digest.sql
25cf8a81d1ac6010fd5de1f82dc21d3bab87dfc9728a3cf76cd61c8428817d58  supabase/migrations-wip/dec193/20261016044300_cms_revision_manifest_currentness.sql
0303359a136fc58d688fdac076b25e818494d4504e343673ad33e67c865d3c23  supabase/migrations-wip/dec193/20261016044400_cms_preflight_pattern_provider.sql
a47bf25715d0753eb04e65abfd1fa930c5e9c3827889cdf1ba69ca39028a7aa4  supabase/migrations-wip/dec193/20261017044500_cms_restore_composition_plan.sql
f50ed10fc5340cd34b55c65cb999f4d053d114b3925028d970deb9b164600a20  supabase/migrations-wip/dec193/20261017044510_cms_restore_composition_lock_plan.sql
4d61d677cba37615708a01e4e62df04afc7e70c997e376c8277db733f394f408  supabase/migrations-wip/dec193/20261017044600_cms_restore_composition_registry.sql
57d93681fb69360f4c15ea67df0fc715bf0611b394dab5dce6fadbd42f6263b3  supabase/migrations-wip/dec193/20261017044700_cms_restore_composition_copy.sql
4a38cd2e91d96f155477ef08f594e4672ce75bbc75af819fd2a328fd1cc974ff  supabase/migrations-wip/dec193/20261017044710_cms_restore_composition_ref_qualification.sql
2f5b60666e04fbea1bd2fb3e0702289a3209cd01f06dc6cf952d1f83cdb7b992  supabase/migrations-wip/dec193/20261017044720_cms_restore_composition_registry_qualification.sql
d01270f87106d7d510246b0a454a143d4e2fa93795f443f4d6ba84ffe6452f7c  supabase/migrations-wip/dec193/20261017044800_cms_restore_composition_integration.sql
f5bb77625f85f11c0e433376424d1fe73baa62e165e6406ea5d97f087b502f25  supabase/migrations-wip/dec193/README.md
363603cf15e556cfeaa17176a1e401f5d16690373da2af822acd21c3814d9cad  docs/handoffs/2026-10-22-claude-s12/lane-repair-a-report.md
ff85f459958b05f668d32e16be572e3604fd47da3720847b6fbf3265ab16769e  docs/handoffs/2026-10-22-claude-s12/lane-repair-a-corrections-pattern-updates.diff
```

Specification and decision sources read: BE03c `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md`
(SHA-256 `b47b0567c3f9f6b1445283c835f675102d1f00fb77ba7470c184aa2c0728766c`), sections "Pattern versions and linked updates"
(1505-1515), "Slice 12 lock order" (1482-1503), "Receiving obligations from Slice 10" (1566-1575), "Preflight providers" (1562-1564),
CompositionInstance table row (1591), validation rows 385/408/410, error matrix 1411/1413, authority rows 1628/1642/1644/1656,
BE03b "Write-path lock order" (1734-1752) and the D5 text (1712, 1718, 1792, 2292); `.memory/wiki/decisions.md`
(SHA-256 `2100e85e9da6f5653f79a2723aa069977c461adfd4d8eca06e1b883bde1e7f85`) DEC-175, 176, 181, 185, 186, 187, 193 (with the
owner clarification "Honor each choice"), 198, 199, 200, 201, 202 (full text); DEC-188 and DEC-189 only as cited by BE03c. The pre-repair state of the untracked test trees was taken from the
same intake backup (extracted read-only into the reviewer scratchpad) so every changed oracle could be diffed exactly.

## Method (what was actually checked)

- Read every one of the 54 migrations line by line.
- Mechanical comparisons: `040400` body vs promoted `20261014110300` (single line differs: the template-slot predicate);
  `041400` vs `140500` (only the choices path predicate); `041500` vs `041100` (locked-target hunk only); `041800` vs `040700`
  (local variable rename only); `041100/041500` vs `140600` (all differences are DEC-193 intended); `040300` vs `140400`
  (plan call, `slotPath`, `newRoots`, `bulkEligible`); `041300` vs promoted resource function (contentHash delegates to the shared
  image); recomputed octet length, md5 and sha256 of the `prosrc` pinned by `044710` and `044720` from `044500` and `044600`
  (7777 and 10086 octets, all digests match).
- Function map over promoted plus all WIP directories: no promoted or other-lane `create or replace` of any in-scope function name;
  the only other lane that patches a function the scope also patches is `locale-gate` (`cms_evaluate_preflight`, earlier timestamp;
  it inserts its branch before the shared `elsif registry_row.provider_key <> 'preflight.' || ...` line and leaves that line intact, so
  `044400`'s anchor still occurs exactly once: verified by reading both). `dec206` reads `cms_revision_effective_composition` and
  `cms_composition_instance_resource`, so it must be promoted after `dec193`.
- Scripted checks over all 54 files: 43 created functions (24 SECURITY DEFINER, 19 SECURITY INVOKER) all carry
  `set search_path = ''`; every NEW function is `alter function ... owner to wejammin_cms_definer` and `revoke all ... from public,
  anon, authenticated, service_role`; the only GRANTs to a non-definer role are `grant usage on schema platform_api` and
  `grant execute` to `service_role` on the two public wrappers (`platform_api.cms_get_instance_update_diff`,
  `platform_api.cms_apply_pattern_update`); no DROP, DELETE, TRUNCATE, trigger disabling, `session_replication_role`, non-ASCII byte,
  CRLF, tab, TODO or "UNRUN" marker; no timestamp collides with any of the 536 promoted and WIP files; every file name matches
  `^\d{14}_[a-z0-9_]+\.sql$`.
- Dynamic SQL exists only in migration DO blocks over fixed text (`execute pg_get_functiondef` with exact-anchor `replace`, fixed
  `grant execute` closures); none takes user input. Every anchored amendment (`041700, 041900, 042200, 042400, 042500, 042600,
  042900, 043400, 043700, 044300, 044400, 044710, 044720, 044800`) asserts owner, SECURITY DEFINER, volatility, `proconfig`, anchor
  count exactly 1, text invertibility, and (for most) that every `pg_proc` attribute except `prosrc` plus the comment are unchanged
  after the replacement, so none can silently lose a tail or change an ACL.

## Findings

| ID | Severity | File:line | Summary |
| --- | --- | --- | --- |
| R1-001 | MAJOR | `dec193/20261016041600_cms_detached_tree_safe_props.sql:64-65,104-113` (first form `040800:62-65,100-109`); call site `041500:233-247` | The CMS-03C-15 writer refuses accept and ordinary detach on block `allowedChildren` and `slotRules.maxNodes/maxDepth`; the spec basis is at best implicit, no other operation enforces it, and no test asserts a refusal. |
| R1-002 | MAJOR (spec question) | `dec193/20261016042200_cms_revision_composition_carry_rpcs.sql:35-42` (resolve anchor, `base_row.id`) | `cms_resolve_conflict` carries composition from the conflict BASE; the entry's current draft (`theirs`), the only revision CMS-03C-02/-15 write to, loses its placements in the resolved draft. Spec-literal, but silent data loss. |
| R1-003 | MINOR | `dec193/20261017044700_cms_restore_composition_copy.sql` (326 lines) | Exceeds the 300-line file limit. |
| R1-004 | MINOR | `040700/041800`, `040800/041600`, `041100/041500`, `041900/042900`, `044500/044710`, `044600/044720`, `140200..140600` vs dec193 | Superseded intermediate bodies would be frozen into immutable history; `044710`, `044720`, `044800` pin the md5/sha256 of earlier bodies. |
| R1-005 | MINOR | `pattern-updates/20261014140200_cms_pattern_update_plan.sql:11-16,30-85,158-178` | `cms_pattern_update_view` and `cms_pattern_update_effective_props` are dead after dec193 and carry the rejected shortest-suffix heuristic. |
| R1-006 | MINOR | `dec193/20261016041000_cms_pattern_update_next_row_dec193.sql:50` | Accept/detach rows copy the head's `carried_from_id` (`v_row := p_head`); the column means "immediate source row for revision carry"; untested. |
| R1-007 | MINOR (spec ambiguity) | `dec193/20261016041500...:120` and `041100:116`; test `pattern_updates/040-refusals.sqlinc:47-51` | Naming a non-newest row of a path is 409 `VERSION_MISMATCH`; BE03c 410 and 1413 say 422 at `/instances/{n}/instanceId`. |
| R1-008 | MINOR | `dec193/20261016042500...:43-56`, `042600...:35-38` | Render plan emits one entry per descendant node with pointer `/composition/{id}/nodes/{i}` for linked rows too; BE03c 1511 says the plan "reads each row as one block"; the pointer grammar is documented nowhere in the specs. |
| R1-009 | MINOR | repair-a `pattern_placement/050-refusals.sqlinc` (O1 removal) | After the removal nothing detects `octet_length` regressing to `char_length` in the 248-octet bound (DEC-186 says octets). |
| R1-010 | MINOR | `dec193/20261016041800...:81-84`, `042300...:44-47`, `040200:40-41`; promotion runbook | Rows placed by the promoted permissive producer at nested slot paths (`/main/more/...`) become unresolvable: shared readers (render plan, manifest build, checker input) RAISE after promotion; no preflight. Also WIP timestamps precede promoted `20261020203606`. |
| R1-011 | NIT | `dec193/README.md` | Documents 15 of 44 files (29 absent). |
| R1-012 | NIT | `044200:134-136`, `044300:37-39` | Blanket `exception when others` turns programming faults into `provider_unavailable` / `false`. |
| R1-013 | NIT | `044400:65-72` | Registry row for DEC-199 reuses the DEC-134 seed owner id; locale uses its own id (`...138`). |
| R1-014 | NIT | `140500`/`041400` | `cms_pattern_update_check` is SECURITY DEFINER although it reads no table. |

### R1-001 (MAJOR) untested, inconsistently enforced refusal: block allowedChildren and slotRules at accept and detach

Evidence.
- `cms_detached_tree_registry` (final form `041600`) builds `v_rules` from `v_block.allowed_children` and `v_block.slot_rules`
  (lines 64-65), then refuses with `VALIDATION_FAILED` when a subtree has more nodes or levels than the block's
  `maxNodes`/`maxDepth` (lines 104-106) or when a child block key is not in the parent's `allowedChildren` (lines 109-113). The
  writer runs it for every non-retired new row (`041500:233-247`): linked accept (target tree), `yours` accept (resolved tree) and
  every ordinary detach (pinned tree).
- Nothing else in the repository enforces these registry members. `allowed_children`/`slot_rules` occur in promoted SQL only in the
  registry table and the four block-registration migrations (`20260902080000`, `20261002207000`, `20261003130400`,
  `20261003130600`); in TypeScript only in `packages/contracts/src/content-schema-registry/requests-release.ts` and Worker
  fixtures. CMS-03C-12 (pattern create), CMS-03C-02 (place), template definition and the publication providers do not check them. A
  block registered with `allowedChildren: []` (the leaf case) therefore cannot parent anything under this check, yet such a pattern
  can be created, activated and placed.
- No pgTAP file asserts a refusal caused by these two rules. In `supabase/tests` the string `allowedChildren` appears only inside
  block-registration fixtures (`dec193_consumers/000-fixture.sqlinc:116`, `dec193_resolution/000-fixture.sqlinc:119-124`,
  `dec193_writer_boundaries/010-expanded-choice.sqlinc:43`, `dec193_carry/010-append-conflict.sqlinc:10`,
  `021-restore-boundary-fixture.sqlinc:44`, `dec193_diff/000-fixture.sqlinc:86-87`, and the older `pattern_definition` and
  `pattern_updates_common` worlds). The fixtures were registered permissively (`maxDepth 16`, `maxNodes 512`, the child key listed)
  so the branch never fires. The branch is production code with no failing test, against `.claude/rules/tdd-contract-first.md`.

Spec. The basis is at best implicit. BE03c:1515: detach "is bounded by the pattern node limit the pinned version already
satisfies (at most 512 nodes ...), so detach has no key-count refusal"; the accept refusal list is "an invalid graph, an
unregistered or protected block, or a protected `props` or `children` value" (422 at `/instances/0/choices`); BE03c:1656 says
composition graphs "enforce protected depth/node/slot counts before save and again before publish". If the owner reads "protected
children value" and "protected depth/node/slot counts" as the registry's `allowedChildren` and `slotRules`, then CMS-03C-12 (save),
CMS-03C-02 (place) and the publication provider must enforce the same rules and every refusal needs a RED test; none does today.
03a:1084-1088 defines the two members as registration data only.

Impact. An author can place a pattern, then be unable to accept an update or detach it (422 with an uninformative pointer), with no
spec text that predicts it; a deprecated-then-changed registry row changes the outcome of an already-valid operation. The behaviour
freezes into immutable history at promotion.

Fix (pick one, root/owner): (a) ratify by a BE03c row (what `allowedChildren` and `slotRules` mean for a pattern subtree, for
placement, accept, detach and publication), enforce symmetrically in CMS-03C-12/-02/the pattern provider, and add RED tests for each
refusal and each boundary (`maxNodes`, `maxDepth`, a disallowed child, an empty allow-list); or (b) delete lines 64-65 and 104-113's
slot/children clauses from `041600` (and the matching ones in `040800`, or squash per R1-004) so the check is exactly what BE03c
names: registered, non-reserved, non-withdrawn identities, type compatibility, per-value JSON bounds, executable-leaf policy.

### R1-002 (MAJOR, spec question) conflict resolution carries composition from the base revision

Evidence. `042200` anchors the carry call with `base_row.id` in both `cms_create_revision` and `cms_resolve_conflict`. In
`cms_resolve_conflict` (`20261005018050_cms_resolve_conflict_derived_state.sql:185-200`) `base_row` is the conflict's BASE revision
while `theirs_row` must equal the entry's `current_draft_revision_id`. CMS-03C-02 and CMS-03C-15 write only to the current draft
(BE03c:1511 `revision_not_editable`; `041100:102-108`). So any placement, accept or detach made on `theirs` after the base is
absent from the resolved revision, which becomes the new current draft. Test `dec193_carry` case `CC-RES001..003` deliberately
asserts this ("the explicit readable baseRevision supplies composition ... no competing current composition policy is inferred",
`dec193_carry/README.md`).

Spec. BE03c:1573 obligation 4 literally says "select the base revision's newest row at each composition path". The behaviour matches
the text and DEC-198/DEC-200, so this is not a migration defect; it is a spec choice whose consequence (silent loss of the current
draft's composition on every resolved conflict) is not stated anywhere.

Fix. Owner confirmation before promotion (the function is frozen afterwards). If the base is intended, record the consequence in
BE03c and in the FE conflict-resolution copy; if the current draft (`theirs`) is intended, change the second anchor to
`theirs_row.id` and the CC-RES oracle.

### R1-003 (MINOR) 044700 is 326 lines

`wc -l` = 326 against "Keep each new SQL file under 300 lines" (lane rules; review brief item 3). Move the `$owner$` and `$closure$`
tail (lines 276-326) into a new `20261017044705_cms_restore_composition_copy_acl.sql`; no other migration pins the bytes of this
file (`044800` checks signatures and ACLs, not source).

### R1-004 (MINOR) superseded bodies and digest-pinned amendment chain

Pairs: `040700` has an ambiguous-identifier defect for template-bound entries (local `template_id` against
`cms_template_versions.template_id`) fixed by `041800`; `040800` is replaced whole by `041600`; `041100` carries the target-lock race
that `041500` closes (the pre-lock candidate may differ from the plan target); `041900` and `042900` patch the same reader twice
(`042900` anchors on `041900`'s text); `044500`/`044600` have the same identifier defect (`template_id`, `root_chain` against the
`cms_pattern_update_nodes` output column) fixed by `044710`/`044720`; pattern-updates `140200`, `140400`, `140500`, `140550`,
`140600` are all replaced by dec193. `044710` (7777 octets, md5 `419e2a3b...`, sha256 `ce8bbb41...`), `044720` (10086 octets) and
`044800` (27517 octets, `a8e0b1e8...`) pin the exact source of the previous function body. I recomputed the first two from the
files: they match today. Consequence: promoting everything freezes bodies already known to be wrong, and any edit to `044500` or
`044600` (for example to apply a fix from this report) makes `044710`/`044720` abort the whole reset. Fix: either squash each pair
into its first file and delete the second (re-run the affected suites), or promote as is and treat these files as untouchable.

### R1-005 (MINOR) dead legacy helpers

`cms_pattern_update_view` (140200:30-85) and `cms_pattern_update_effective_props` (140200:158-178) are referenced only by
`140200` and by the superseded `140550`; `grep` over promoted and all WIP SQL finds no other caller. They implement the
shortest-slot-prefix heuristic (140200:11-16, 51-70) that the dec193 README rejects ("no shortest-suffix/identity heuristic").
Two extra SECURITY DEFINER bodies with grants are frozen for nothing. Fix: drop them (and the `effective_props` call) when
squashing per R1-004, or accept as dead code.

### R1-006 (MINOR) accept/detach rows inherit carried_from_id

`cms_pattern_update_next_row` builds the new row with `v_row := p_head` (041000:50) and never resets `carried_from_id` (added by
`042000`, comment "Private immediate source row for revision carry"; BE03c:1591 "revision-append and restore carry-over
provenance"). An accept or detach row appended in the same revision therefore claims the head's cross-revision carry source as
its own immediate source. No test reads the column after accept/detach (`grep carried_from supabase/tests` hits only
`dec193_carry`/`dec193_consumers` copy assertions). Fix: `v_row.carried_from_id := null;` after line 50 and one assertion in
`pattern_updates` (or document the intended inheritance in BE03c).

### R1-007 (MINOR, spec ambiguity) older row: 409 or 422

`041500:120` (`041100:116`) answers `VERSION_MISMATCH` (409, detail has `instanceId`) when the named row is not the head of its
path. BE03c:410 says "each instance is the newest version of its path and a linked `active` or `pending_diff` row (accept) or any
linked pattern-origin row (detach), else 422 `COMPOSITION_VALIDATION_FAILED` at `/instances/{n}/instanceId`", and the error matrix
(BE03c:1413) lists "an older row" under 422 while "stale entry or instance version" is 409. The pre-DEC-193 test
`pattern_updates/040-refusals.sqlinc:47-51` (`r-instance-old-row`) pins 409 and was not revisited by the DEC-193 cascade. 409 is the
better behaviour (a stale client must refresh), but the text says otherwise. Fix: root records the reading in BE03c 410/1413 (an
older row named with its own version is a stale instance version, 409) or changes the code and the test.

### R1-008 (MINOR) render plan and checker input: descendants and an undocumented pointer grammar

`042500:43-56` emits, for every head row, one plan entry per node of `cms_composition_effective_nodes`, with pointer
`/composition/{headId}` for node 0 and `/composition/{headId}/nodes/{i}` otherwise; `042600:35-38` joins on that string. BE03c:1511
says the render plan "reads each row as one block at its own `path`"; BE03c:1515 requires descendants only for a row that carries a
`detached_tree`. The migration applies the descendant expansion to NULL-tree linked rows as well, which changes the plan, the
checker input and `renderPlanHash` for every existing revision with a linked pattern root that has children. `grep "/composition/"`
over `.memory/wiki/specs` and `packages/contracts/src` finds no pointer grammar. `dec193_consumers/README.md` states "No exact
undocumented descendant-pointer suffix is invented", while `040-checker-boundaries.sqlinc:36,90-97` asserts `/nodes/N`.
Fix: add the pointer grammar and the linked-row descendant rule to BE03b/BE05c (so promotion has a spec row), or restrict
descendant entries to detached trees.

### R1-009 (MINOR) coverage after the O1 removal

See the test-correction verdict for P2: accepted because the behaviour is unreachable through any producer, but after the removal no
test pins "octets, not characters". Fix (cheap): one pgTAP case calling
`platform_private.cms_pattern_placement_selected_plan(owner, pattern_row, '/main/' || repeat('é', 119), '{}', null)` directly as the
test owner (no insert, no trigger change): 119 two-byte characters must be 422 `/slotPath`, 118 must pass.

### R1-010 (MINOR) legacy nested-slot rows and the promotion runbook

The promoted producer (`20261014110300`) accepted a template-bound `slotPath` by first segment, so rows such as `/main/more/hero`
(slot_key `main`) can exist in any database that used it. After `040400` plus the consumers, `cms_pattern_root_snapshot` finds no
node for root chain `/more/hero` and raises `NOT_FOUND` (`041800:81-84`; the diff reader raises it at `040200:40-41`), and
`cms_composition_effective_nodes` (`042300:44-47`) feeds the render plan, the dependency manifest and the checker input, so a
revision holding such a row fails in those shared readers instead of answering a 404. The README states "Invalid legacy
nested-slot placement history is not repaired or certified here". Add a guard (a DO block after `040400`, or in `040300`) that,
for every pinned row of a template-bound revision, expands the pinned forest with `cms_pattern_update_nodes(..., strict := false)`
and raises SQLSTATE 55000 when the row's root chain (its `path` minus `'/' || slot_key`) is not a root chain of that forest with
the row's block identity (note that `starts_with(path, slot || '/')` alone does not detect these rows: `/main/more/hero` passes it);
or at minimum make the populated-database witness seed such a row through the promoted producer and assert the intended failure
mode. Separately: every scope file has a timestamp
earlier than the promoted `20261020203606`, so a database that already applied it needs `--include-all` (`migration up` and
`db push` otherwise reject out-of-order files); a fresh reset is unaffected. `dec206` (`20261022050000`) uses
`cms_revision_effective_composition` and `cms_composition_instance_resource`, so promote dec193 first (timestamp order does).

### Nits

R1-011: the README stops at `041400` (29 of the 44 migrations are not mentioned); it is deleted at promotion, but a reviewer reading
it gets a wrong inventory. R1-012: `exception when others` in `cms_pattern_active_digest` (044200:134) and
`cms_revision_manifest_identities_current` (044300:37) is fail-closed by design (BE03c: unexpected dependencies are unavailable) but
hides defects such as the two identifier bugs above from the pgTAP results; consider catching only the expected SQLSTATEs.
R1-013: `044400:70` seeds the DEC-199 row with the DEC-134 owner id; harmless, unusual. R1-014: store-free
`cms_pattern_update_check` needs no definer rights.

## Test-correction verdicts (lane `claude_s12_repair_a`)

Method: the pre-repair text of the three untracked test trees was extracted from the intake backup and diffed against the current
files; for `pattern_updates` the rebuilt diff is identical (all 12 hunk bodies) to `lane-repair-a-corrections-pattern-updates.diff`;
the `pattern_placement` (3 files, 4 hunks) and `pattern_update_diff` (2 files, 6 hunks) diffs were rebuilt the same
way, and the three composition harness files (10 inserts) were diffed as well. Every added line was scanned for trigger disabling,
`session_replication_role`, `set role`, DDL and direct `insert/update/delete` against `platform_private`: none. The report's own claim
that no `.sql` entry file changed is true (`pattern_placement.sql`, `pattern_update_diff.sql`, `pattern_updates.sql` are byte-identical
to the backup).

| ID | Files | Verdict | Reason and spec line | Coverage and fixture check |
| --- | --- | --- | --- | --- |
| H1 | `composition_authority`, `composition_instance_guards`, `composition_owner_integrity` (10 inserts) | ACCEPT | `position integer NOT NULL` since promoted `20261014110000` (DEC-185; BE03c:1591). Harness, not feature: the files abort with 23502 without it. | Same direct fixtures that test the guards and FKs themselves (pre-existing); values 0/1 are distinct per parent/child; no producer bypass introduced. |
| P1 | `pattern_placement/040-positive` (p6b) | ACCEPT | A template slot is flat and exact: BE03c:1511 ("the request slotPath must exist in the revision's template"), `040400`, slot key grammar `^[a-z][a-z0-9_-]{1,63}$` (`20260927200000:103`). The nested `/main/more` placement is now a 422 (asserted by `dec193_slot_binding`). | Intent kept (third placement into one slot never shares or interleaves a position); positions `{7,12..22}` follow DEC-185 arithmetic (first position = greatest + 1 = 20, three roots a/b/c of fixture `pc`, `030-patterns.sqlinc:13-15`). |
| P2 | `pattern_placement/050-refusals` | ACCEPT, follow-up R1-009 | 248/249-octet bound now reached the only reachable way, through nested-reference key chains (BE03c:1511 DEC-186: chain = reference keys then root key): `5 + 3*61 + 60 = 248` accepted, leaf key one character longer refused 422 `/slotPath`; a new "wrote nothing" assertion (count 0) was added. | The removed multi-byte cases (`path-247-octets` accepted, `path-249-octets` refused, `len4` max octet 247) are UNREACHABLE through CMS-03C-02: slot keys are ASCII-checked in SQL (`cms_define_template` and its successors, `!~ '^[a-z][a-z0-9_-]{1,63}$'`), pattern node keys likewise (`cms_pattern_node_shape_valid`, `20261014020000`), and `040400` requires `slotPath` to equal `'/'` concatenated with a template slot key. They are covered nowhere else, so `octet_length` could regress to `char_length` unnoticed: see R1-009 for a producer-free replacement. The former `path-249-octets` request is kept as `multibyte-nested-slot` (still 422 `/slotPath`, now because the slot does not exist; the label overstates). Chain fixtures go through the real governed pattern producer (`s12pl_pattern`). |
| P3 | `pattern_placement/060-big` | ACCEPT | The 1 MiB response ceiling (DEC-189) is now proven with the largest producible response: 512 rows of 248-octet ASCII paths built from real patterns (`5+61+61+61+60`, `32*16`); the quote-escaped slot path no longer names a slot and its JSON-escape worst case is unreachable (ASCII keys). | The four size/length assertions are kept; reported 412,061 compact / 428,445 padded bytes. |
| D1 | `pattern_update_diff/010-diff`, `020-states` | ACCEPT | Typed resource of DEC-193: node value = props + `blockKey`/`blockVersion` + ordered `children`; `collisionKind` first-match order `removed_root`, `structure`, `props`; `slotPath`; `newRoots`; a newer collision-free target is bulk eligible even with no changed path; removal of the instance's own root is always a `removed_root` collision (`d-gone`: false to true, `bulkEligible` true to false); older/non-head rows answer the no-update diff with `slotPath` and `newRoots` (BE03c:1515, 408, 1642). | Assertions strengthened (exact key set now includes `newRoots` and `slotPath`; every path asserts kind, children and yours). Expected documents are hand-derived from the world trees. |
| U1 | `pattern_updates/000-oracles` | ACCEPT | contentHash of a row with a nonnull `detached_tree` hashes the canonical detached content and treats the pin as provenance (BE03b:1712, 2292); the oracle image (`detachedTree` member, `patternRef` null) equals `041200` and the independent image in `dec193_consumers/010`. The exact member set is a lane decision, not spelled out in BE03b (spec gap, not a defect). | The `retired` expectation no longer asserts props. Acceptable: BE03c is silent on a tombstone's props, retired heads are excluded from D5, render and manifest, and `dec193_resolution/020` makes the same exclusion; NIT only. |
| U2 | `pattern_updates/010-accept` | ACCEPT | Removed root is a `removed_root` collision needing a choice (missing choice is 422 `/instances/0/choices`, new assertion); `theirs` appends a `retired` row keeping the pin of the row it follows (1, not 2); `yours` appends an `active` detached row pinned 1 with props `{}` and the resolved tree (BE03c:1515, DEC-193 "Honor each choice"). | Added refusal; all other assertions unchanged. |
| U3 | `pattern_updates/020-detach`, `050-bulk`, `075-eligibility` | ACCEPT | Detach materializes `detached_tree` with props `{}` and keeps the pin as provenance; detach admits a retired and a superseded newest head and has no key-count refusal (the 156-node root is materialized in full, preorder, 1 + 5 + 150 nodes) (BE03c:1515, 1644; node limit 512). | The three removed refusals (`d-retired`, `d-wide`, `e-sp1-detach`) are contradicted by DEC-193, so nothing needs to cover them. `sp1` (superseded head) and the `pending_diff` heads are guarded fixture inserts that pre-date repair-a (no producer writes those states yet): replace them with the real scan producer when AC-212/213 lands. |
| U4 | `pattern_updates/070-adoption` | ACCEPT | A changed block identity is a `structure` collision: bulk accept is 409 `diff_has_collisions`; each root is then accepted alone with an explicit `theirs` (choices are single-instance only) (BE03c:410, 1515). | Adopted identity and digest assertions unchanged; a refusal assertion added. |

No correction weakens an assertion except where the asserted behaviour is contradicted by a locked decision (U2, U3, U4, D1) or
unreachable (P2 multi-byte, P3 escaping); the only unpinned residue is R1-009 and the NIT in U1.

## Promotion verdict per lane

- `pattern-updates`: PROMOTE together with `dec193` in timestamp order. It is internally consistent (dependency order verified:
  140100 nodes, 140200 plan, 140400/140410 reader and wrapper, 140500 check, 140550 next row, 140600/140605/140610 writer, closure and
  wrapper), forward-only, ACL/ownership correct, the two public wrappers are `service_role`-only and clone the promoted CMS-03C-02
  wrapper shape (nested `deadlock_detected`/`lock_not_available` to `CONFLICT`, RPC-flag restore, ETag header). The populated-table
  rule of `140000` is safe (nullable column, guard refuses only a hand-written `pending_diff` row, CHECK holds for all other rows).
  Not promotable alone (R1-004/R1-005 context).
- `dec193`: FIX FIRST. Required before promotion: R1-001 (ruling plus code or test change), R1-002 (owner confirmation), R1-003
  (split `044700`). Strongly recommended with the same re-run: R1-010 guard in `040400`, R1-006, and the R1-004 squash decision.
  Everything else verified clean (below). After any edit of `044500`, `044600`, `040700`, `040800`, `041100` or `041900`, recompute the
  pins/anchors of `044710`, `044720`, `041800`, `041600`, `041500`, `042900` and re-stage the whole cohort (the README itself says a
  partial directory snapshot is not valid).

## Verified clean (positive confirmations, with where)

- Security: all 24 SECURITY DEFINER bodies have `set search_path = ''`; all 19 INVOKER helpers too; NEW functions are owned by
  `wejammin_cms_definer` and revoked from `public, anon, authenticated, service_role` (private pure helpers) with EXECUTE only to
  `service_role` on `platform_api.cms_get_instance_update_diff` (`140410:31-32`) and `platform_api.cms_apply_pattern_update`
  (`140610:49-50`); no table GRANT to `anon`/`authenticated`/`service_role`; RLS untouched; no user-controlled dynamic SQL.
- Authority parity with the promoted producer: reader (`040300:50-53`) and writer (`041100:85-90`) use
  `cms_authority_origin(actor, party, 'cms.editor'|'cms.author', entry)`, the same call as `cms_insert_pattern_instance:87-90`
  (BE03c:1628, 1642, 1644); concealment 404 before any 403 (hidden/foreign instance or entry: `NOT_FOUND`; visible, no edit:
  `capability_missing`); the writer resolves and conceals every instance before the entry lock, requires one entry, locks entry (0),
  authority rows with re-proof (1), reserves idempotency (replay returns the stored response), CAS, current-draft check, pattern rows
  `FOR SHARE` in ascending id (3), content-type row (4), review rows `FOR UPDATE` (5): BE03c:1488 (positions 0,1,3,4,5).
  Block-definition rows are share-locked after position 5 in `(block_key COLLATE "C", block_version)` order, the same order as
  `cms_pattern_registry_digest`; shared-only mode, so no cycle is possible.
- Effects: one audit record, no outbox event, live review invalidated `dependency_changed` in the same transaction, entry version
  `+ 1`, positions copied unchanged, `contentHash` image shared with the D5 comparison (`041200`/`041300`/`041900`), no content in
  audit or idempotency payloads (`CompositionInstanceResource` exposes no props and no tree).
- Restore (DEC-201): relation targets are fenced at position 2 before the dependency position 3 and schema position 4 (an
  inversion in the promoted body, fixed by `044800`), captured closure re-derived and re-compared after waits, withdrawn or missing
  blocks fail 409 `migration_chain_incomplete`, parents remapped by path, parent-first insertion, digests re-pinned.
- Publication provider (DEC-199): precedence `pattern_not_active`, `nested_pattern_not_active`, `pattern_digest_changed`; count
  capped at 1000; canonical trees validate their own reachable blocks and keep the pin as provenance; a NULL-tree detached row keeps
  the pinned behaviour (BE03c:1564).
- Populated database: `040000` (nullable column, CHECK true for NULL), `042000` (nullable FK, MATCH SIMPLE, unique `(id, owner_id)`
  exists at `20260927340000:12`) and `140000` (guard then nullable column) rewrite no rows; the CHECK validation scan runs under the
  usual `lock_timeout 5s` / `statement_timeout 30-60s`.
- Anchors: each amended live function was compared in the file against its predecessor definition; none can lose a tail.

## Limits of this review

Executed: `PATH=<pinned toolchain> pnpm exec vitest run tests/contracts/phase-02-slice-12-pattern-updates-pending-parity.test.ts
tests/contracts/phase-02-slice-12-pattern-placement-witness-parity.test.ts
tests/contracts/phase-02-slice-12-pattern-lineage-witness-parity.test.ts` (3 files, 9 tests, passed; the pending-parity test proves the
`140000` DDL equals the populated-table witness byte for byte). Not executed: any SQL, pgTAP or race module (brief). The pgTAP
outcomes are taken from the lane TAP records
(`lane-repair-a-report.md`); I verified that the reviewed WIP bytes equal the intake backup, not the TAP contents. Not reviewed:
Worker, web and contract code, other WIP lanes, `related_perf` timing, S09 inventory pins. R1-001 and R1-002 are judgments about
spec coverage that need the owner's ruling, not proof of a runtime fault.

## Requests to root

1. Rule on R1-001 and R1-002 (one question each, options in the findings) before promotion.
2. Decide the R1-004 squash; if squashing, re-run `pattern_updates`, `dec193_*`, `dec201_*`, `pattern_update_diff` and the S10 restore
   suites on the new stack and recompute the pinned digests.
3. Add the R1-010 legacy-row guard (or the populated-DB witness) and promote with `--include-all` semantics in the runbook.
4. Record R1-007 and R1-008 in BE03c/BE03b/BE05c so promotion has a spec row; add the R1-009 unit case.
5. `git status` shows the 100 promoted migrations from `20261013300000` on, `supabase/migrations-wip/` and the pattern test trees as
   untracked: commit explicit file lists at promotion so immutability is enforced by history, not convention.
