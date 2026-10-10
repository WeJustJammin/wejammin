# 2026-10-10 — Phase 2 Claude continuation prompt (owner, verbatim)

## Provenance and correction

This prompt was composed outside the repository and refers to an attachment named
`2026-10-10-phase2-claude-handoff.md`. That file does not exist in this repository, in any
worktree, in the GitHub remote, or in the conversation that delivered this prompt. It was
drafted from GitHub state alone while local inspection was blocked by a Codex usage limit.

The authoritative resume source is therefore the newest Codex-authored Claude handoff on
disk: [`2026-10-09-phase2-claude-handoff.md`](2026-10-09-phase2-claude-handoff.md), whose
`Latest` section is dated 2026-10-10 and whose last update was 2026-10-10 13:45 local.

Baseline reconciliation verified on 2026-10-10:

| Claim in the prompt | Verified state |
| --- | --- |
| Remote `main` is `3640b506c314e8622d84cd3e4caeebcff718b2a5` | Correct. `origin/main` is at that commit. |
| Local checkout / branch / HEAD unverified | Primary checkout `/home/rob/Projects/WeJammin` is on `main` at `37c0a86e`, 29 commits behind `origin/main`, with two untracked CMS editorial directories that must not be staged. |
| PR #124 (S09) and PR #126 (S10) merged | Correct, and neither closes every acceptance obligation. |
| Phase 2 is 9/17; Slice 10 is 91/105 and not acceptance-closed | Correct for `origin/main`. |
| Resume point | Not Slice 10. Slice 11 is in flight on `claude/phase2-slice11` in `/home/rob/.codex/worktrees/phase2-slice11/WeJammin`, 100 commits ahead of `origin/main`, pushed through `618ec5c1`, with five uncommitted forward precision migrations. Slice 11 has 122 criteria, none checked. Slices 12–17 are unstarted. |
| DEC-147 scope choice is needed before proceeding | DEC-155 already rules that AC035/AC038/AC041 wording defects stay unapplied and join the owner DEC-147 wording batch, and the live handoff's hard constraints keep DEC-147/DEC-155 wording and the Slice 10 AC045/AC047/AC056 evidence gaps partial. No new owner ruling is required to continue; the affected rows simply remain partial. |
| DEC-148 depth-floor cascade at S11/S12 setup | The Slice 11 portion is already ruled on by DEC-149 and DEC-154 (additive; Slice 11 floor 122). The outstanding cascade work begins at Slice 12. |

## Owner prompt, verbatim

Use Opus 5.5 at the highest available reasoning setting for planning, research, validation, independent review, orchestration, and integration. Use Sonnet 5.5 at high reasoning for execution. Verify those exact models/settings are available. Do not silently substitute or claim unsupported settings. If either is unavailable, tell me exactly what is missing and ask before changing models. Use a fresh independent Opus reviewer context, separate from the author; no author self-certification. This is my latest model-routing instruction. Preserve repository review quality and flag any genuine unresolved conflict instead of automatically requiring Codex.

Continue WeJammin Phase 2 through /implement-slice and /validate-phase. Read the attached 2026-10-10-phase2-claude-handoff.md first. The verified remote main is 3640b506c314e8622d84cd3e4caeebcff718b2a5. Local checkout, branch, HEAD, and dirty state are unverified. Historical S09 PR124 and S10 PR126 are merged; that does not itself close every acceptance obligation.

1. Read and preserve.
Discover the actual repository and worktrees, then inspect local HEAD, branch, working tree, index, running work, recovery refs, and newer local decisions before changing anything. The local inspection for this handoff was blocked by the Codex usage limit. The old ac8b2c19 checkpoint and historical checkout path are not current facts. Preserve existing and unrelated work; do not reset or clean it away.

Save this prompt and the companion handoff under docs/handoffs/ in the verified repository if they are not already there, preserving existing versions. Read AGENTS.md, CLAUDE.md, the relevant rules/instructions, the exact workflow skills and source paths listed in the handoff, the current Phase 2 plan/trackers, and full cited IA/BE/FE sections. Follow project-specific standards and pnpm scripts rather than generic kit publishing examples. Recheck GitHub and local state before trusting the snapshot.

2. Reconcile, then execute.
The verified remote baseline is main 3640b506c314e8622d84cd3e4caeebcff718b2a5, PR126 merged, exact-main CI37774676292 and staging37779431600 successful. Phase 2 is still 9/17. Slice09 is 1235/1235 active; Slice10 is 91/105 checked and is not acceptance-closed.

Preserve my exact decision: "AC261 approve; O1 A". That covers DEC132/133, not DEC147. Look for a newer explicit owner ruling locally. If none exists, ask for DEC147's scope choice before rewording or waiving its 12 partial criteria. Reconcile AC060 against the merged change and fresh evidence; retain AC056's Slice12 obligation. Correct stale tracking from proof, not assumption. Continue valid independent Slice12 work while a decision blocks the dependent path.

Finish Slices09-17 as their actual remaining work requires. Run /implement-slice with its setup and TDD shards for each applicable slice. At S11/S12 setup, perform DEC148's full per-operation depth-floor cascade and reconcile receiving criteria, plans, trackers, and denominators. Respect dependency order. Use contract -> failing tests -> complete data/API/SSR/island implementation -> passing tests -> refactor. Parallelize independent execution with clear ownership, then integrate and verify. Make implementation decisions yourself; bring genuinely new product/architecture choices to me under the repository rules.

3. Run the gates.
Use the verified commands and evidence procedures in the handoff, including pnpm validate, pnpm db:verify, pnpm progress:check, and the relevant receipt refresh. Read current scripts first. Coordinate the shared local DB/self-hosted CI lock; never reset an unverified target or race CI. Preserve evidence outside Playwright's cleared output directories.

Require exact behavioral assertions for every acceptance clause and depth-floor item. Run independent adversarial/refutation review in a fresh Opus reviewer context, fix confirmed findings RED->GREEN, regenerate affected evidence, and rerun final canonical gates on the final tree. Retain exact run and commit identities. Do not reduce coverage or substitute mock success for real composition/hosted proof.

4. Close tracking honestly.
Update slice, phase, index, feature ledger, runbooks, architecture/spec graph, receipts, depth ratio, completion signature, project records, and session log together. Flush the canonical project records using the current repository workflow, run node .memory/pipeline/compile.mjs, run pnpm progress:check, and reread the actual files. Never mark a slice complete solely because its PR merged or tests are green.

Keep AC209, AC211, AC265, and AC266 on their declared external timelines. AC265/266 remain mandatory prerelease gates; AC209 needs genuine post-deployment delivery evidence; AC211 needs postlaunch operational evidence. Their exclusion from active implementation counts does not waive them. Do not auto-merge blocked PR54 or fold unrelated PRs into this task.

5. Integrate and clean up within permission.
Check the actual authorization for commits, pushes, PRs, merges, and staging promotion; use existing valid approval without repeatedly asking, and ask when authority is missing. New PRs should be draft unless I instructed otherwise. A main merge triggers staging after green CI. Do not trigger production promotion. Preserve backups, worktrees, orchestration records, and DB stacks until their exact ownership, contents, and disposal authority are verified. Before removing a worktree or recovery material, verify a clean worktree/index, merged or durably retained work, and recoverability. Dirty, unmerged, shared, or unverified resources stay intact. Remove only confirmed task-owned disposable resources and completed claims.

6. Continue to a truthful finish.
Keep going through the next dependency-valid slice without stopping for routine implementation choices. Once the phase's slice prerequisites are genuinely met, run /validate-phase, including quality and readiness, its applicability matrix, full spec coverage, CI/staging/migration checks, accessibility/performance/security/dependency checks, feature-ledger and boundary audits. Fix authorized failures and rerun.

Report implementation completion separately from validation, prerelease readiness, and postlaunch obligations. If completion requires an owner choice, unavailable requested model/reviewer, missing authority, or genuine external evidence, state the exact blocker and smallest next action, preserve a resumable checkpoint, and continue any independent authorized work. Do not manufacture a pass to call Phase 2 finished.

Final delivery: list completed slices and remaining criteria; validation commands, results, and evidence; PRs/commits and verified integration/staging status; owner decisions and release gates still open; cleanup performed or deliberately preserved; and the exact next action if anything is blocked. Keep claims tied to verified outcomes.

## Model-routing status at receipt

The receiving Claude Code session runs model id `claude-opus-5` at effort `high`. The
requested `claude-opus-5-5` at the highest effort setting was not in effect, and a session
cannot change its own model or effort — that selection belongs to the owner in the app's
model menu. Subagent model selection in this harness accepts family aliases
(`opus`, `sonnet`, `haiku`, `fable`) rather than exact version ids, and exposes no
per-subagent reasoning-effort parameter. Per the owner's instruction, execution was paused
for an explicit routing decision rather than substituting models silently.
