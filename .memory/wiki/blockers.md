# Blockers

## Summary

- **Total blockers**: 7
- **Unique blocker titles**: 7

## BLOCKER-001: `gh` authenticated as personal account, not business account (2026-07-16)

- **Occurrences**: 1
- **Latest timestamp**: 2026-07-16T12:00:00.000Z
- **Agents**: claude
- **Sources**: ideate
- **Index**: [[index]]

- **Status**: **resolved** (2026-07-16)
- **Impact**: Blocked (a) the initial `git push` of the WeJammin repo, and (b) self-hosted runner registration, which requires minting a repo registration token from an authorized account.
- **Detail**: `gh` was authed as `NEVRITERob` (personal). The repo transferred to `WeJustJammin`. Git commit identity was set repo-local to `WeJustJammin <305953066+WeJustJammin@users.noreply.github.com>`, so commits attributed correctly; only the transport was affected.
- **Resolution**: User ran `gh auth login` interactively. `WeJustJammin` is now the active account with `admin: true` on the repo; `NEVRITERob` retained as a non-active second account. Initial push completed — repo is no longer empty.

## BLOCKER-002: `wejamm.in` DNS not pointed at Cloudflare (2026-07-16)

- **Occurrences**: 1
- **Latest timestamp**: 2026-07-16T12:00:00.000Z
- **Agents**: claude
- **Sources**: ideate
- **Index**: [[index]]

- **Status**: active
- **Impact**: Blocks `/setup-workspace-hosting`. Not urgent — deploy is ~8 pipeline stages away — but DNS propagation takes hours, so early action has real value.
- **Resolution**: Point nameservers at Cloudflare. May require action at the registrar rather than in the Cloudflare dashboard. Nameserver changes are account settings — require explicit per-action user confirmation.

## BLOCKER-003: Self-hosted GitHub runners not installed (2026-07-16)

- **Occurrences**: 1
- **Latest timestamp**: 2026-07-16T12:00:00.000Z
- **Agents**: claude
- **Sources**: ideate
- **Index**: [[index]]

- **Status**: **resolved** (2026-07-16)
- **Impact**: Blocked the owner's stated CI/CD preference (GitHub → Cloudflare deploy without consuming Actions minutes).
- **Detail**: Owner wanted 2–3 local runners as systemd services, autostarting on boot. Motivation sound — `nevrite-music` is **private**, so Actions minutes are metered (unlimited only on public repos).
- **Resolution**: **3 runners installed and verified online.** See `.memory/wiki/specs/ideation/meta/constraints.md` § Self-Hosted Runner Fleet for the full build. Key deviation from the official path: `sudo` requires a password on this host, so GitHub's `svc.sh install` (which writes to `/etc/systemd/system`) was unusable. Used **`systemd --user`** units instead — `Linger=yes` was already enabled for `rob`, so user services autostart at boot without login. Same runtime user, same autostart guarantee, no root required.
- **Verified**: smoke-test workflow fanned 3 matrix jobs across all 3 runners (one each), Cloudflare egress confirmed from the runner host, **0 minutes billed**.
- **⚠️ SECURITY GATE — STILL LIVE**: Self-hosted runners are safe here **only because the repo is private**. If `nevrite-music` is ever made public, the runners **must be removed or reconfigured first** — a fork's pull request would otherwise execute untrusted code on Rob's machine with his user privileges. This gate does not expire with this blocker.

## BLOCKER-004: Ideation remediation decisions await owner selection (2026-07-19)

- **Occurrences**: 1
- **Latest timestamp**: 2026-07-22T15:30:00.000Z
- **Agents**: claude
- **Sources**: ideate-validate
- **Index**: [[index]]

- **Status**: active
- **Impact**: Blocks the required fresh full `/audit-ambiguity ideation` gate and therefore `/create-prd`.
- **Detail**: **All decision work is complete.** Canonical remediation-state reconciles 107 manifest findings as **107 `verified-fixed`** — 0 product, 0 architecture, 0 deferred-with-interim-rule. All 26 blocking findings are resolved, all 43 canonical decision-queue entries are ratified, and every interim rule has been replaced with a full contract. P-01 / `r-44[0]` closed on its policy on 2026-07-22: the validation gate is decided and in force, and collecting its practitioner evidence (two beatmakers, two session players, per `specs/audits/p01-production-stage-vocabulary-validation.md`) is tracked implementation work — the same disposition applied to A-03 and A-04. No candidate stage label is enforceable until that packet passes. The final disposition ledger is `.memory/wiki/specs/audits/remediation-state.md`; the decision queue is `.memory/wiki/specs/audits/ideation-remediation-decision-queue.md`.
- **Resolution**: **Decision work is complete.** Two steps remain before `/create-prd`: (1) the graph refresh — **done 2026-07-22**, spec graph rebuilt to 1,218 nodes / 7,474 edges; (2) a fresh full `/audit-ambiguity ideation`. The recovery ledger cannot substitute for that run, and the gate does not expire with this blocker. Separately tracked, not blocking the audit: P-01's practitioner traces and enum approval.

## BLOCKER-009: Session limit truncated triage check phase (2026-07-23)

- **Occurrences**: 1
- **Latest timestamp**: 2026-07-23T18:53:15.125Z
- **Agents**: claude
- **Sources**: expired-deferral-triage
- **Index**: [[index]]

### BLOCKER-009: Session limit truncated the expired-deferral triage (2026-07-23)
- **Status**: active
- **Impact**: The 177-unit citation-check phase died entirely on `You've hit your session limit · resets 9am (America/New_York)`, along with 12 of 189 triage units. Consequences on disk: (a) 566 "already answered" resolutions citing a `D-`/`DEC-`/`DT-` decision are UNVERIFIED — no agent confirmed the citations are real; (b) 142 expired open-question rows remain across 19 domains (the 12 failed units + scattered rows successfully-run units did not fully clear); (c) `.memory/wiki/specs/audits/owner-decision-queue.md` (923 rows) is therefore PROVISIONAL.
- **Resolution**: After the 9am ET reset, resume `Workflow({scriptPath: "/tmp/claude-1000/-home-rob-Projects-WeJammin/5b54e4f2-15e5-4aff-a313-3eae561a316c/scratchpad/triage-workflow.js", resumeFromRunId: "wf_884d11c7-65a"})` — the 177 completed triage units replay from cache; the 12 failed units + all 177 check units run live. Then re-measure expired to 0 and regenerate the owner queue.

## BLOCKER-010: IA layer fails fresh ambiguity audit at 19.48% (2026-08-05)

- **Occurrences**: 1
- **Latest timestamp**: 2026-08-05T06:09:09.154Z
- **Agents**: claude
- **Sources**: /audit-ambiguity ia
- **Index**: [[index]]

- **Status**: active
- **Impact**: Blocks `/write-fe-spec` for shards 15-42 and any further IA-dependent work. The BE layer was authored against these IA shards after the voided 2026-08-03 PASS, so a `be`-scoped audit should follow IA remediation.
- **Score**: 67/344 = 19.48% ambiguity across 83 documents. 2 of 43 shards fully clean.
- **Systemic defects**: F1 — shards 00-23 use a legacy Interactions schema with no Preconditions or Failure/recovery column, leaving 393 of 773 acceptance criteria with an identical boilerplate Given and refusal clause. F2 — 52 of 218 declared cross-shard contract edges are never acknowledged by the target shard. F3 — 54 dangling cross-shard references across 10 shards, naming 18 shard slugs that do not exist in this decomposition.
- **Agent findings**: 138 raw, 104 refuted on adversarial review, 34 upheld (25 blocking).
- **Report**: `.memory/wiki/specs/audits/2026-08-05-ia-ambiguity-report.md`
- **Resolution**: unresolved. Remediation deferred to a single pass; 14 items need owner decisions first.

## BLOCKER-020: Local database runs can starve CI of the shared Supabase lock (2026-11-01)

- **Occurrences**: 1
- **Latest timestamp**: 2026-11-01T21:02:26.423Z
- **Agents**: claude
- **Sources**: branch-consolidation
- **Index**: [[index]]

- **Status**: active
- **Impact**: CI runs themselves never overlap: ci.yml has one repository-wide concurrency group (ci-${{ github.repository }}, cancel-in-progress false), so runs queue, and a newer queued run cancels an older pending one. All three self-hosted runners share one local Supabase stack with local lanes and evidence runs, and infra/verify-database.sh waits only 600 s for /tmp/wejammin-supabase-ci.lock. A local run holding the lock longer (an evidence regeneration takes about 35 min) fails the CI database job.
- **Resolution**: Open. Do not hold the lock locally while a CI run is queued or running, or lengthen the database job lock wait.

## Full Log

### BLOCKER-001: `gh` authenticated as personal account, not business account (2026-07-16)

- **Timestamp**: 2026-07-16T12:00:00.000Z
- **Agent**: claude
- **Source**: ideate
- **Tags**: blocker, ideation, recovered

- **Status**: **resolved** (2026-07-16)
- **Impact**: Blocked (a) the initial `git push` of the WeJammin repo, and (b) self-hosted runner registration, which requires minting a repo registration token from an authorized account.
- **Detail**: `gh` was authed as `NEVRITERob` (personal). The repo transferred to `WeJustJammin`. Git commit identity was set repo-local to `WeJustJammin <305953066+WeJustJammin@users.noreply.github.com>`, so commits attributed correctly; only the transport was affected.
- **Resolution**: User ran `gh auth login` interactively. `WeJustJammin` is now the active account with `admin: true` on the repo; `NEVRITERob` retained as a non-active second account. Initial push completed — repo is no longer empty.

### BLOCKER-002: `wejamm.in` DNS not pointed at Cloudflare (2026-07-16)

- **Timestamp**: 2026-07-16T12:00:00.000Z
- **Agent**: claude
- **Source**: ideate
- **Tags**: blocker, ideation, recovered

- **Status**: active
- **Impact**: Blocks `/setup-workspace-hosting`. Not urgent — deploy is ~8 pipeline stages away — but DNS propagation takes hours, so early action has real value.
- **Resolution**: Point nameservers at Cloudflare. May require action at the registrar rather than in the Cloudflare dashboard. Nameserver changes are account settings — require explicit per-action user confirmation.

### BLOCKER-003: Self-hosted GitHub runners not installed (2026-07-16)

- **Timestamp**: 2026-07-16T12:00:00.000Z
- **Agent**: claude
- **Source**: ideate
- **Tags**: blocker, ideation, recovered

- **Status**: **resolved** (2026-07-16)
- **Impact**: Blocked the owner's stated CI/CD preference (GitHub → Cloudflare deploy without consuming Actions minutes).
- **Detail**: Owner wanted 2–3 local runners as systemd services, autostarting on boot. Motivation sound — `nevrite-music` is **private**, so Actions minutes are metered (unlimited only on public repos).
- **Resolution**: **3 runners installed and verified online.** See `.memory/wiki/specs/ideation/meta/constraints.md` § Self-Hosted Runner Fleet for the full build. Key deviation from the official path: `sudo` requires a password on this host, so GitHub's `svc.sh install` (which writes to `/etc/systemd/system`) was unusable. Used **`systemd --user`** units instead — `Linger=yes` was already enabled for `rob`, so user services autostart at boot without login. Same runtime user, same autostart guarantee, no root required.
- **Verified**: smoke-test workflow fanned 3 matrix jobs across all 3 runners (one each), Cloudflare egress confirmed from the runner host, **0 minutes billed**.
- **⚠️ SECURITY GATE — STILL LIVE**: Self-hosted runners are safe here **only because the repo is private**. If `nevrite-music` is ever made public, the runners **must be removed or reconfigured first** — a fork's pull request would otherwise execute untrusted code on Rob's machine with his user privileges. This gate does not expire with this blocker.

### BLOCKER-004: Ideation remediation decisions await owner selection (2026-07-19)

- **Timestamp**: 2026-07-22T15:30:00.000Z
- **Agent**: claude
- **Source**: ideate-validate
- **Tags**: blocker, ideation, remediation, recovered

- **Status**: active
- **Impact**: Blocks the required fresh full `/audit-ambiguity ideation` gate and therefore `/create-prd`.
- **Detail**: **All decision work is complete.** Canonical remediation-state reconciles 107 manifest findings as **107 `verified-fixed`** — 0 product, 0 architecture, 0 deferred-with-interim-rule. All 26 blocking findings are resolved, all 43 canonical decision-queue entries are ratified, and every interim rule has been replaced with a full contract. P-01 / `r-44[0]` closed on its policy on 2026-07-22: the validation gate is decided and in force, and collecting its practitioner evidence (two beatmakers, two session players, per `specs/audits/p01-production-stage-vocabulary-validation.md`) is tracked implementation work — the same disposition applied to A-03 and A-04. No candidate stage label is enforceable until that packet passes. The final disposition ledger is `.memory/wiki/specs/audits/remediation-state.md`; the decision queue is `.memory/wiki/specs/audits/ideation-remediation-decision-queue.md`.
- **Resolution**: **Decision work is complete.** Two steps remain before `/create-prd`: (1) the graph refresh — **done 2026-07-22**, spec graph rebuilt to 1,218 nodes / 7,474 edges; (2) a fresh full `/audit-ambiguity ideation`. The recovery ledger cannot substitute for that run, and the gate does not expire with this blocker. Separately tracked, not blocking the audit: P-01's practitioner traces and enum approval.

### BLOCKER-009: Session limit truncated triage check phase (2026-07-23)

- **Timestamp**: 2026-07-23T18:53:15.125Z
- **Agent**: claude
- **Source**: expired-deferral-triage
- **Tags**: blocker, session-limit, audit, triage

### BLOCKER-009: Session limit truncated the expired-deferral triage (2026-07-23)
- **Status**: active
- **Impact**: The 177-unit citation-check phase died entirely on `You've hit your session limit · resets 9am (America/New_York)`, along with 12 of 189 triage units. Consequences on disk: (a) 566 "already answered" resolutions citing a `D-`/`DEC-`/`DT-` decision are UNVERIFIED — no agent confirmed the citations are real; (b) 142 expired open-question rows remain across 19 domains (the 12 failed units + scattered rows successfully-run units did not fully clear); (c) `.memory/wiki/specs/audits/owner-decision-queue.md` (923 rows) is therefore PROVISIONAL.
- **Resolution**: After the 9am ET reset, resume `Workflow({scriptPath: "/tmp/claude-1000/-home-rob-Projects-WeJammin/5b54e4f2-15e5-4aff-a313-3eae561a316c/scratchpad/triage-workflow.js", resumeFromRunId: "wf_884d11c7-65a"})` — the 177 completed triage units replay from cache; the 12 failed units + all 177 check units run live. Then re-measure expired to 0 and regenerate the owner queue.

### BLOCKER-010: IA layer fails fresh ambiguity audit at 19.48% (2026-08-05)

- **Timestamp**: 2026-08-05T06:09:09.154Z
- **Agent**: claude
- **Source**: /audit-ambiguity ia
- **Tags**: blocker, ia, audit, ambiguity

- **Status**: active
- **Impact**: Blocks `/write-fe-spec` for shards 15-42 and any further IA-dependent work. The BE layer was authored against these IA shards after the voided 2026-08-03 PASS, so a `be`-scoped audit should follow IA remediation.
- **Score**: 67/344 = 19.48% ambiguity across 83 documents. 2 of 43 shards fully clean.
- **Systemic defects**: F1 — shards 00-23 use a legacy Interactions schema with no Preconditions or Failure/recovery column, leaving 393 of 773 acceptance criteria with an identical boilerplate Given and refusal clause. F2 — 52 of 218 declared cross-shard contract edges are never acknowledged by the target shard. F3 — 54 dangling cross-shard references across 10 shards, naming 18 shard slugs that do not exist in this decomposition.
- **Agent findings**: 138 raw, 104 refuted on adversarial review, 34 upheld (25 blocking).
- **Report**: `.memory/wiki/specs/audits/2026-08-05-ia-ambiguity-report.md`
- **Resolution**: unresolved. Remediation deferred to a single pass; 14 items need owner decisions first.

### BLOCKER-020: Local database runs can starve CI of the shared Supabase lock (2026-11-01)

- **Timestamp**: 2026-11-01T21:02:26.423Z
- **Agent**: claude
- **Source**: branch-consolidation
- **Tags**: blocker, ci

- **Status**: active
- **Impact**: CI runs themselves never overlap: ci.yml has one repository-wide concurrency group (ci-${{ github.repository }}, cancel-in-progress false), so runs queue, and a newer queued run cancels an older pending one. All three self-hosted runners share one local Supabase stack with local lanes and evidence runs, and infra/verify-database.sh waits only 600 s for /tmp/wejammin-supabase-ci.lock. A local run holding the lock longer (an evidence regeneration takes about 35 min) fails the CI database job.
- **Resolution**: Open. Do not hold the lock locally while a CI run is queued or running, or lengthen the database job lock wait.
