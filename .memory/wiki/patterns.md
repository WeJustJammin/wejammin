# Patterns

## Summary

- **Total patterns**: 22
- **Unique pattern titles**: 19

## PAT-001: Verify a generated claim against the kit's own reference before propagating it (2026-07-16)

- **Occurrences**: 1
- **Latest timestamp**: 2026-07-16T12:00:00.000Z
- **Agents**: claude
- **Sources**: ideate
- **Index**: [[index]]

- **Type**: best-practice
- **Confidence**: 0.6
- **Context**: When a subagent, workflow, or generated artifact asserts a consequence that would change a locked pipeline decision.
- **Pattern**: A multi-agent sweep's synthesis asserted that adding a fan audience "changes the classification to multi-surface". Checking `prd-templates/references/surface-model.md` showed this was false — a **surface is a deployment target** (web/mobile/desktop/cli/api/extension), **not an audience**. Fans and professionals on one Astro web app remain `single-surface`; the fan is a *persona*, and the real consequence is an expanded Role Matrix, not a folder-layout change. Had this propagated, it would have restructured the entire ideation tree on a false premise. **Always verify a generated claim against the kit reference that owns the concept before acting on it.**
- **Source**: Sweep synthesis (`wf_253689b4-284`) conflating audience with surface; caught pre-seeding. Logged as D-12 in the ideation index.

## PAT-002: Check the actual blocker before answering with the policy reason (2026-07-16)

- **Occurrences**: 1
- **Latest timestamp**: 2026-07-16T12:00:00.000Z
- **Agents**: claude
- **Sources**: ideate
- **Index**: [[index]]

- **Type**: anti-pattern
- **Confidence**: 0.5
- **Context**: When a user asks "why haven't you done X?"
- **Pattern**: Asked why the repo wasn't initialized, the agent answered "because you hadn't asked me to" (true, and the standing rule). But the *actual* blocker was that **no git identity was configured at all** — `user.name`/`user.email` were unset globally and locally, so any commit would have failed regardless. The policy answer was correct but incomplete, and stating it first framed the situation as a permission question when it was a configuration question. **Check the mechanical state before reaching for the policy explanation** — the user is usually asking about the world, not about the rules.
- **Source**: User asked "why havent you initiated the repository"; correction self-identified after inspecting `git config`.

## PAT-003: A verification pass that refutes nothing is a signal, not a success (2026-07-16)

- **Occurrences**: 1
- **Latest timestamp**: 2026-07-16T12:00:00.000Z
- **Agents**: claude
- **Sources**: ideate
- **Index**: [[index]]

- **Type**: best-practice
- **Confidence**: 0.6
- **Context**: When running adversarial verification over generated candidates.
- **Pattern**: 24 of 24 candidate domains survived 3× adversarial verification with **zero majority-refutations**. A 100% survival rate is evidence about the *verifiers* as much as the candidates — it may mean the map was strong, or that the refute-prompts were too weak to bite. Mitigating evidence mattered: the adversaries *did* alter the map (21 demotions, boundary narrowing on domains 01/03/08), which shows they engaged rather than rubber-stamped. **Report the zero-refutation rate as a caution flag rather than as validation**, and hand the hypothesis forward (logged as D-17 for `/audit-ambiguity ideation` to treat domain-count inflation as live).
- **Source**: Workflow `wf_253689b4-284` — 88 agents, 1,545 concepts, 24/24 survived.

## PAT-004: Recover pipeline state from the tree before rerunning a staged workflow (2026-07-19)

- **Occurrences**: 1
- **Latest timestamp**: 2026-07-19T12:00:00.000Z
- **Agents**: claude
- **Sources**: ideate-validate
- **Index**: [[index]]

- **Type**: best-practice
- **Confidence**: 0.5
- **Context**: After a workflow interruption, stale status report, or lost background-agent completion signal.
- **Pattern**: Before restarting a stage, inspect the canonical index, actual folder tree, counts, completed decision ledger, and session records. An interrupted WeJammin recovery appeared to need extract-shard seeding, but ground-truth inspection showed the authoritative tree already contained 24 domains, 165 sub-domains, 734 feature leaves, 1,120 ideation files, complete CX synthesis, and an 8/8 ideation rubric. **Recover and reconcile evidence; never reseed, replace, or cascade based only on a workflow's stale apparent state.**
- **Source**: Ideation recovery/reconciliation, 2026-07-19; documented in DEC-013 / D-35.

## PAT-005: Do not conflate a validation-gate decision with validation completion (2026-07-21)

- **Occurrences**: 1
- **Latest timestamp**: 2026-07-21T12:00:00.000Z
- **Agents**: claude
- **Sources**: ideate-validate
- **Index**: [[index]]

- **Type**: anti-pattern
- **Confidence**: 0.6
- **Context**: A product owner selects a validation-first policy for a source contract whose required evidence has not yet been collected.
- **Pattern**: Record the gate, its evidence requirements, and immutable boundaries immediately, but retain the canonical finding as unresolved until required traces, mismatch dispositions, pass/fail result, and explicit approval exist — *unless* the finding's own text was about the policy rather than the evidence, in which case closing on the policy is correct and the evidence becomes tracked implementation work (see DEC-047, and the A-03/A-04 precedent). Do not advance counts, lifecycle contracts, enums, or downstream implementation from a candidate merely because the validation procedure was approved.
- **Source**: P-01 production-stage vocabulary reconciliation and independent re-audit: the owner selected Option B, and the packet's beatmaker/session-player trace register and approved enum version remain pending even after the finding closed on its policy.

## PAT-006: Never hand-author a derived file, and read a build script before running it (2026-07-22)

- **Occurrences**: 1
- **Latest timestamp**: 2026-07-22T16:00:00.000Z
- **Agents**: claude
- **Sources**: ideate-validate
- **Index**: [[index]]

- **Type**: anti-pattern
- **Confidence**: 0.7
- **Context**: Any repository where some files are generated from a source of truth — here, `.memory/wiki/{decisions,patterns,blockers}.md` are **derived** by `.memory/pipeline/compile.mjs` from `.memory/raw/{events,sessions}/*.jsonl`.
- **Pattern**: Two failures compounded into real data loss on 2026-07-22.
  (1) **Writing to the derived file instead of the source.** Thirty-nine decisions, two patterns and one blocker were hand-authored directly into `wiki/*.md` over several sessions. They looked durable and were not — nothing linked them to `raw/`, so they existed only until the next compile.
  (2) **Running a build command without reading it.** `node .memory/pipeline/compile.mjs` was run against 1,100+ uncommitted files on the assumption it *derived* a graph. It also **overwrites** all three wiki files from `raw/`, which was empty. The three files were regenerated as empty stubs and every hand-authored entry was gone.
  The rules: **write to the source, never the artifact** — use `flushEntry()` from `.memory/pipeline/flush.mjs`, then compile. And **read a script before running it**, especially before a command whose name suggests it only generates. "Derived" in a README is a *warning*, not a description. Commit first when a large working tree is uncommitted.
- **Source**: 2026-07-22 — self-inflicted, disclosed immediately, recovered by reconstructing DEC-009–047 / PAT-004–005 / BLOCKER-004 as raw records. Also drove the correction of `.claude/rules/memory-capture.md`, which had instructed exactly the failing write path.

## PAT-007: A spec's declared affectedFiles under-declares — sweep the whole tree (2026-07-23)

- **Occurrences**: 1
- **Latest timestamp**: 2026-07-23T03:05:00.000Z
- **Agents**: claude
- **Sources**: audit-ambiguity
- **Index**: [[index]]

- **Type**: anti-pattern
- **Confidence**: 0.7
- **Context**: Propagating a ratified decision into a spec tree, where each decision entry carries a list of files it claims to affect.
- **Pattern**: Scoping propagation agents to each decision's **declared** `affectedFiles` list left 22 places still asserting the reading the decision had rejected — including self-contradictions inside a single file, where a Decisions table was correctly rewritten while a Role Lens row, Happy Path step or user-facing copy string three sections down kept the old rule. Re-running with **domain-wide** scope found **229 further** stale readings, i.e. the declared lists under-declared by roughly 4x. **Never scope a propagation pass to a declared file list. Grep the whole tree for the wording of the reading being rejected.** The blind spots are consistent: Role Lens rows, Happy Path steps, copy strings, edge-case cells, Cross-Cut Notes, index/CX footers, and Deep Think rows restating a changed rule — agents edit Decisions tables and stop. Corollary: a verifier's finding list is a *sample*, not a complete set — always re-sweep after fixing what it listed.
- **Source**: 2026-07-23 propagation of 57 ratified decisions into the WeJammin ideation tree. Self-inflicted; the audit that produced the decisions exists precisely to catch stale downstream copies, and the propagation reproduced the defect while fixing it.

## PAT-008: An agent asked to apply a decision will invent the value the decision withheld (2026-07-23)

- **Occurrences**: 1
- **Latest timestamp**: 2026-07-23T03:06:00.000Z
- **Agents**: claude
- **Sources**: audit-ambiguity
- **Index**: [[index]]

- **Type**: anti-pattern
- **Confidence**: 0.6
- **Context**: Applying a decision that deliberately defers a value (an instrument name, a threshold, an enum) to a later pipeline stage.
- **Pattern**: A propagation agent rewriting a Happy Path to match a new decision filled the deliberately-empty US statutory profile with an invented `23:00` operating-hours limit and `98 dB`, complete with "each carrying the issuing authority" — plausible, well-formed, and contradicting **two** ratified decisions at once (one deferred the instrument names; the other says that profile declares no such instrument at all). The pressure is grammatical, not careless: prose needs a noun, and "the slot deferred to a later stage" reads worse than a number. **Make "did anyone fill in a value a decision deferred?" an explicit, separately-reported verification check** — it will not surface as a contradiction, because the invented value is internally consistent. The fix instruction that works: name the SLOT, never an instrument.
- **Source**: 2026-07-23 propagation; caught by the independent verify pass, removed in a third cleanup pass.

## PAT-009: Main loop completes a subagent phase the session limit dropped (2026-07-23)

- **Occurrences**: 1
- **Latest timestamp**: 2026-07-23T19:08:13.240Z
- **Agents**: claude
- **Sources**: expired-deferral-triage
- **Index**: [[index]]

### PAT-009: When a subagent Workflow dies on the session limit, finish its deterministic parts in the main loop (2026-07-23)
- **Type**: best-practice
- **Confidence**: 0.6
- **Context**: A large Workflow (triage + 177-unit check phase) died mid-run on `You've hit your session limit · resets 9am (America/New_York)`. The main loop is NOT subject to the same cap and kept operating.
- **Pattern**: Before declaring "blocked until reset", split the dropped phase into deterministic sub-jobs the main loop can do with code/Read/Edit, and only defer the parts that truly need parallel judgment. Concretely, three moves paid off: (1) the check phase's most important job — "does any 'already answered' row cite a fabricated D-NN?" — is a pure citation-existence check; done in code it found 0 fabrications across 770 struck rows (resolve same-file, then dotted spec-number refs like `05.01.03 DT-01`, then the CQ canonical namespace). (2) The residual "142 expired rows" were 87% measurement artifact: 123 were already-resolved rows whose Deferred-To cell cosmetically retained the completed stage name; only 19 were genuinely open. Always split resolved-cosmetic from genuinely-open before assuming unfinished work. (3) Hand-triage the small genuine remainder (19 rows) directly. Only the semantic re-check of bucket-A resolutions and the fresh full `/audit-ambiguity` truly needed the reset.
- **Source**: expired-deferral triage, run wf_884d11c7-65a. Related: [[BLOCKER-009]], PAT-006 (raw-record durability), PAT-007 (domain-wide scope).

## PAT-010: a contradiction with no open marker is a real finding class (2026-07-29)

- **Occurrences**: 1
- **Latest timestamp**: 2026-07-30T00:38:30.702Z
- **Agents**: claude
- **Sources**: propagate-decision (DQ-R2-01)
- **Index**: [[index]]

- **Type**: best-practice
- **Confidence**: 0.6
- **Context**: Triaging audit findings in the ideation tree, deciding whether a flagged unit is a
  genuine gap or a stale artefact.
- **Pattern**: PAT-008 established that some findings are **stale parent-CX markers** — the [DEEP]
  child already answers what the parent still flags as pending. DQ-R2-01 is the **inverse**: the
  parent asserted a confident identity ("scope IS the mandate") with **no marker at all**, while the
  child omitted the axis entirely. So "does it carry an open marker?" is not a sufficient triage
  test in either direction. The reliable test is **satisfiability**: take the document's own claim
  literally and try to instantiate it. Here, "scope is the mandate" plus a closed seven-value enum
  plus a five-value scope list is unsatisfiable on arithmetic alone — provable without judgement.
  Findings on units whose only open questions point elsewhere deserve *more* scrutiny, not less:
  a silent contradiction has nothing tracking it.
- **Source**: DQ-R2-01. `01.03.02`'s two [OWNER] questions were commission (`:97`) and on-platform
  signing (`:98`) — neither was the gap. Four adversarial agents attempted five refutations; all
  five failed.

## PAT-011: verify a decision's affected-files list by grep, not by reading the decision (2026-07-29)

- **Occurrences**: 1
- **Latest timestamp**: 2026-07-30T00:38:30.702Z
- **Agents**: claude
- **Sources**: propagate-decision (DQ-R2-01)
- **Index**: [[index]]

- **Type**: anti-pattern
- **Confidence**: 0.7
- **Context**: Propagating a ratified decision through the spec tree.
- **Pattern**: DQ-02 ratified the seven-verb enum, and its recorded affected-files list **omitted
  `01.03.02`** — the one file in 1,122 that names a competing scope vocabulary. The propagation then
  ran correctly against an incomplete target list, and the contradiction survived two full audit
  runs. **The failure mode is not a bad propagation; it is a bad target list.** Never derive the
  affected-files list from the decision's own text or from the prior propagation record — derive it
  by grepping the tree for every competing term the decision settles, then diff that against the
  recorded list. A decision that fixes a vocabulary must target every file using **any** vocabulary
  in that slot, not just files citing the decision.
- **Source**: DQ-R2-01 root-cause analysis. Related: [[PAT-006]] (writing to derived artefacts
  instead of raw records) — both are cases of trusting a generated record over ground truth.

## PAT-012: Validate decomposition at both boundary and ledger granularity (2026-08-02)

- **Occurrences**: 1
- **Latest timestamp**: 2026-08-03T01:33:14.100Z
- **Agents**: codex
- **Sources**: decompose-architecture
- **Index**: [[index]]

- **Type**: best-practice
- **Confidence**: 0.6 (applied 1 time)
- **Context**: Decomposing a deep fractal ideation tree into dependency-ordered IA shards.
- **Pattern**: Apply shard-load thresholds to direct approved subareas, then independently map every leaf feature through its top-level source prefix and verify total, Must, orphan and duplicate counts. Boundary counts alone can pass while leaf coverage is incomplete; ledger counts alone can hide overloaded boundaries. Also emit explicit wiki relationships because ordinary Markdown links do not satisfy the spec-graph edge linter.
- **Source**: WeJammin /decompose-architecture — 43 shards, 776/776 features, 230/230 Must, 35 deep dives, zero cycles and zero changed-artifact graph warnings.

## PAT-013: A uniform per-document evidence string is proof the audit did not run (2026-08-05)

- **Occurrences**: 1
- **Latest timestamp**: 2026-08-05T06:09:09.157Z
- **Agents**: claude
- **Sources**: /audit-ambiguity ia
- **Index**: [[index]]

- **Type**: anti-pattern
- **Confidence**: 0.6
- **Context**: Reading any prior ambiguity-audit report before trusting its verdict.
- **Pattern**: `2026-08-03-ia-ambiguity-rerun-1.md` recorded 0/344 (0.00%) and cleared IA for `/write-be-spec`. Its per-document table repeats one identical evidence string — "8/8 rubric dimensions; implementer and adversarial checks pass" — for all 43 shards. A fresh run over the same 83 documents scored 19.48%, including 54 dangling cross-shard references detectable by a link check in seconds and present on that date. Treat an identical per-document evidence string across every row as a red flag that one verdict was copied N times, and treat that report's PASS as void rather than superseded. Corollary: run the cheap deterministic checks (link resolution, section presence, table-schema uniformity, reference reciprocity) before or alongside any semantic audit — they are exhaustive, they cannot be faked, and they calibrate whether the semantic pass is credible.
- **Source**: fresh IA audit 2026-08-05 contradicting the 2026-08-03 PASS.

## PAT-014: Calibrate a deterministic screen against real doc conventions before trusting its flags (2026-08-05)

- **Occurrences**: 4
- **Latest timestamp**: 2026-08-28T01:00:00-04:00
- **Agents**: claude, codex
- **Sources**: /audit-ambiguity ia, /audit-ambiguity ia fresh rerun, /audit-ambiguity ia fresh rerun 1
- **Index**: [[index]]

- **Type**: best-practice
- **Confidence**: 0.8 (applied 3 times)
- **Context**: Running regex and structural sweeps across a specification layer.
- **Pattern**: Calibrate deterministic checks against actual document conventions before scoring. This independent rerun treated pipes inside inline code as content rather than Markdown delimiters, allowed both locked interaction-table shapes, and evaluated deep-dive decisions with their owning shard. Those calibrations eliminated screen-generated false positives while preserving exact coverage, flow, contract, edge-case, and acceptance checks.
- **Source**: IA fresh rerun 1 on 2026-08-28; 83 documents and 344 score cells.

## PAT-015: compile.mjs rewrites every file under .memory/wiki/specs/ — never park a working document there (2026-08-05)

- **Occurrences**: 1
- **Latest timestamp**: 2026-08-05T07:28:19.253Z
- **Agents**: claude
- **Sources**: /resolve-ambiguity all ia
- **Index**: [[index]]

- **Type**: anti-pattern
- **Confidence**: 0.6
- **Context**: Writing any generated or working document anywhere under `.memory/wiki/specs/`, including `specs/audits/`.
- **Pattern**: `.memory/pipeline/compile.mjs` invokes `.memory/pipeline/spec-graph.mjs`, which rewrites every Markdown file under `.memory/wiki/specs/` to inject an auto-generated `## Related Specs` footer. `specs/audits/` is not exempt — `compile.mjs` classifies it as `'audit'` and still processes it. A 250 KB remediation worklist written to `specs/audits/` was silently rewritten to 159 KB by the next compile, dropping 11 of its 34 gap sections. The loss was invisible: the file still parsed, still looked complete, and the truncation was only caught because a downstream agent reported a missing section. This is the same failure class as PAT-006 (hand-edits to derived wiki files destroyed by compile), but wider than PAT-006 states — it is not only the three derived files `patterns.md`/`decisions.md`/`blockers.md` that compile owns, it is the whole `specs/` tree.
- **Rule**: working documents, worklists and generated reports intended to survive go outside `.memory/wiki/specs/` — `.memory/pipeline/progress/` is safe and is where the IA remediation worklist now lives. If a document must sit under `specs/`, re-verify it after every compile by checking a structural invariant (section count, heading count, byte size), not by eyeballing it.
- **Corollary**: a spec whose `## Related Specs` block is marked `<!-- spec-graph: auto-generated -->` must never be hand-edited there; edit the source relationships and re-run compile instead.
- **Source**: IA remediation 2026-08-05 — compile run to land DEC-098/099 silently truncated the worklist that the apply pass then consumed.

## PAT-016: Operational truth must be server-owned and fail closed (2026-08-30)

- **Occurrences**: 1
- **Latest timestamp**: 2026-08-30T06:08:13-04:00
- **Agents**: codex
- **Sources**: /implement-slice Phase 1 Slice 01
- **Index**: [[index]]

- **Type**: best-practice
- **Confidence**: 0.6 (applied 1 time)
- **Context**: Server-rendered health, readiness, degraded-state, and operator diagnostic surfaces.
- **Pattern**: Never render query parameters or ordinary request headers as authoritative system state or last-known-good freshness. Derive operational truth from a server-owned boundary; until that boundary is composed, render the explicit degraded/unknown state and omit unverifiable freshness. Keep public responses provider-neutral and require named capability, fresh step-up, reason, and successful audit persistence before private diagnostics.
- **Source**: Phase 1, Slice 01 implementation and adversarial review.

## PAT-017: Generated artifacts need check-only validation outside broad format globs (2026-08-30)

- **Occurrences**: 1
- **Latest timestamp**: 2026-08-30T06:08:13-04:00
- **Agents**: codex
- **Sources**: /implement-slice Phase 1 Slice 01
- **Index**: [[index]]

- **Type**: anti-pattern
- **Confidence**: 0.6 (applied 1 time)
- **Context**: Deterministic OpenAPI/database artifacts and repositories containing protected or historical Markdown.
- **Pattern**: Avoid broad formatter globs that rewrite unrelated protected documents or generator-owned JSON. Give each generated artifact a deterministic `--check` command that compares source-derived bytes without writing, exclude that artifact from generic formatters, and format only the new documentation scope. If a broad formatter is run accidentally, reverse only its explicit unrelated file set before continuing.
- **Source**: Phase 1, Slice 01 validation gate.

## PAT-018: Consumer fixtures cannot prove that required authority producers exist

- **Occurrences**: 1
- **Latest timestamp**: 2026-10-01T20:56:13Z
- **Agents**: codex
- **Sources**: phase-02-slice-09-activation-re-audit
- **Index**: [[index]]

- **Type**: anti-pattern
- **Confidence**: 0.6 (applied 1 time)
- **Context**: Slice acceptance and dependency advancement for protected CMS operations.
- **Pattern**: Do not close a criterion merely because a consumer/RPC passes against hand-built binding, review, or approval rows. Trace every required authority/evidence input to its real application producer and exercise the composed path. A recorded green checkpoint is not sufficient if fixtures silently supply missing upstream behavior. Reopen contradicted criteria and preserve dependent code without promoting acceptance. Local production-built UI fixtures may prove scoped presentation behavior, but never hosted MFA, review provenance, or successful protected activation.
- **Source**: Owner challenged why Slices 10/12 began before Slice 9 was complete; the 2026-09-30 re-audit superseded the recorded 279/279 checkpoint with 261/279.

## PAT: Marker-presence evidence over-claims acceptance (2026-10-02)

- **Occurrences**: 1
- **Latest timestamp**: 2026-10-02T22:05:55.967Z
- **Agents**: claude
- **Sources**: implement-slice (Slice 09 evidence audit)
- **Index**: [[index]]

- **Type**: anti-pattern
- **Confidence**: 0.5
- **Context**: closing hundreds of criteria by tagging test titles with criterion markers and merging lane evidence files.
- **Pattern**: an independent refutation audit of 164 of 953 newly checked Slice 09 criteria found about 38% with an unproven clause and about 5% contradicted (failing marked tests, stubbed error conditions, per-file pass counts copied onto every criterion, merge dropping other layers files, rewording criteria to fit tests). Require: proofs that produce the condition through the real path, one assertion per clause, per-criterion observed text, a guard that checks results not just marker presence, and a separate-population audit before any criterion is marked done.
- **Source**: Slice 09 acceptance audit reports/s09-acceptance-audit.md.

## Full Log

### PAT-001: Verify a generated claim against the kit's own reference before propagating it (2026-07-16)

- **Timestamp**: 2026-07-16T12:00:00.000Z
- **Agent**: claude
- **Source**: ideate
- **Tags**: pattern, ideation, recovered

- **Type**: best-practice
- **Confidence**: 0.6
- **Context**: When a subagent, workflow, or generated artifact asserts a consequence that would change a locked pipeline decision.
- **Pattern**: A multi-agent sweep's synthesis asserted that adding a fan audience "changes the classification to multi-surface". Checking `prd-templates/references/surface-model.md` showed this was false — a **surface is a deployment target** (web/mobile/desktop/cli/api/extension), **not an audience**. Fans and professionals on one Astro web app remain `single-surface`; the fan is a *persona*, and the real consequence is an expanded Role Matrix, not a folder-layout change. Had this propagated, it would have restructured the entire ideation tree on a false premise. **Always verify a generated claim against the kit reference that owns the concept before acting on it.**
- **Source**: Sweep synthesis (`wf_253689b4-284`) conflating audience with surface; caught pre-seeding. Logged as D-12 in the ideation index.

### PAT-002: Check the actual blocker before answering with the policy reason (2026-07-16)

- **Timestamp**: 2026-07-16T12:00:00.000Z
- **Agent**: claude
- **Source**: ideate
- **Tags**: pattern, ideation, recovered

- **Type**: anti-pattern
- **Confidence**: 0.5
- **Context**: When a user asks "why haven't you done X?"
- **Pattern**: Asked why the repo wasn't initialized, the agent answered "because you hadn't asked me to" (true, and the standing rule). But the *actual* blocker was that **no git identity was configured at all** — `user.name`/`user.email` were unset globally and locally, so any commit would have failed regardless. The policy answer was correct but incomplete, and stating it first framed the situation as a permission question when it was a configuration question. **Check the mechanical state before reaching for the policy explanation** — the user is usually asking about the world, not about the rules.
- **Source**: User asked "why havent you initiated the repository"; correction self-identified after inspecting `git config`.

### PAT-003: A verification pass that refutes nothing is a signal, not a success (2026-07-16)

- **Timestamp**: 2026-07-16T12:00:00.000Z
- **Agent**: claude
- **Source**: ideate
- **Tags**: pattern, ideation, recovered

- **Type**: best-practice
- **Confidence**: 0.6
- **Context**: When running adversarial verification over generated candidates.
- **Pattern**: 24 of 24 candidate domains survived 3× adversarial verification with **zero majority-refutations**. A 100% survival rate is evidence about the *verifiers* as much as the candidates — it may mean the map was strong, or that the refute-prompts were too weak to bite. Mitigating evidence mattered: the adversaries *did* alter the map (21 demotions, boundary narrowing on domains 01/03/08), which shows they engaged rather than rubber-stamped. **Report the zero-refutation rate as a caution flag rather than as validation**, and hand the hypothesis forward (logged as D-17 for `/audit-ambiguity ideation` to treat domain-count inflation as live).
- **Source**: Workflow `wf_253689b4-284` — 88 agents, 1,545 concepts, 24/24 survived.

### PAT-004: Recover pipeline state from the tree before rerunning a staged workflow (2026-07-19)

- **Timestamp**: 2026-07-19T12:00:00.000Z
- **Agent**: claude
- **Source**: ideate-validate
- **Tags**: pattern, ideation, recovered

- **Type**: best-practice
- **Confidence**: 0.5
- **Context**: After a workflow interruption, stale status report, or lost background-agent completion signal.
- **Pattern**: Before restarting a stage, inspect the canonical index, actual folder tree, counts, completed decision ledger, and session records. An interrupted WeJammin recovery appeared to need extract-shard seeding, but ground-truth inspection showed the authoritative tree already contained 24 domains, 165 sub-domains, 734 feature leaves, 1,120 ideation files, complete CX synthesis, and an 8/8 ideation rubric. **Recover and reconcile evidence; never reseed, replace, or cascade based only on a workflow's stale apparent state.**
- **Source**: Ideation recovery/reconciliation, 2026-07-19; documented in DEC-013 / D-35.

### PAT-005: Do not conflate a validation-gate decision with validation completion (2026-07-21)

- **Timestamp**: 2026-07-21T12:00:00.000Z
- **Agent**: claude
- **Source**: ideate-validate
- **Tags**: pattern, ideation, recovered

- **Type**: anti-pattern
- **Confidence**: 0.6
- **Context**: A product owner selects a validation-first policy for a source contract whose required evidence has not yet been collected.
- **Pattern**: Record the gate, its evidence requirements, and immutable boundaries immediately, but retain the canonical finding as unresolved until required traces, mismatch dispositions, pass/fail result, and explicit approval exist — *unless* the finding's own text was about the policy rather than the evidence, in which case closing on the policy is correct and the evidence becomes tracked implementation work (see DEC-047, and the A-03/A-04 precedent). Do not advance counts, lifecycle contracts, enums, or downstream implementation from a candidate merely because the validation procedure was approved.
- **Source**: P-01 production-stage vocabulary reconciliation and independent re-audit: the owner selected Option B, and the packet's beatmaker/session-player trace register and approved enum version remain pending even after the finding closed on its policy.

### PAT-006: Never hand-author a derived file, and read a build script before running it (2026-07-22)

- **Timestamp**: 2026-07-22T16:00:00.000Z
- **Agent**: claude
- **Source**: ideate-validate
- **Tags**: pattern, memory, tooling, anti-pattern

- **Type**: anti-pattern
- **Confidence**: 0.7
- **Context**: Any repository where some files are generated from a source of truth — here, `.memory/wiki/{decisions,patterns,blockers}.md` are **derived** by `.memory/pipeline/compile.mjs` from `.memory/raw/{events,sessions}/*.jsonl`.
- **Pattern**: Two failures compounded into real data loss on 2026-07-22.
  (1) **Writing to the derived file instead of the source.** Thirty-nine decisions, two patterns and one blocker were hand-authored directly into `wiki/*.md` over several sessions. They looked durable and were not — nothing linked them to `raw/`, so they existed only until the next compile.
  (2) **Running a build command without reading it.** `node .memory/pipeline/compile.mjs` was run against 1,100+ uncommitted files on the assumption it *derived* a graph. It also **overwrites** all three wiki files from `raw/`, which was empty. The three files were regenerated as empty stubs and every hand-authored entry was gone.
  The rules: **write to the source, never the artifact** — use `flushEntry()` from `.memory/pipeline/flush.mjs`, then compile. And **read a script before running it**, especially before a command whose name suggests it only generates. "Derived" in a README is a *warning*, not a description. Commit first when a large working tree is uncommitted.
- **Source**: 2026-07-22 — self-inflicted, disclosed immediately, recovered by reconstructing DEC-009–047 / PAT-004–005 / BLOCKER-004 as raw records. Also drove the correction of `.claude/rules/memory-capture.md`, which had instructed exactly the failing write path.

### PAT-007: A spec's declared affectedFiles under-declares — sweep the whole tree (2026-07-23)

- **Timestamp**: 2026-07-23T03:05:00.000Z
- **Agent**: claude
- **Source**: audit-ambiguity
- **Tags**: pattern, anti-pattern, propagation

- **Type**: anti-pattern
- **Confidence**: 0.7
- **Context**: Propagating a ratified decision into a spec tree, where each decision entry carries a list of files it claims to affect.
- **Pattern**: Scoping propagation agents to each decision's **declared** `affectedFiles` list left 22 places still asserting the reading the decision had rejected — including self-contradictions inside a single file, where a Decisions table was correctly rewritten while a Role Lens row, Happy Path step or user-facing copy string three sections down kept the old rule. Re-running with **domain-wide** scope found **229 further** stale readings, i.e. the declared lists under-declared by roughly 4x. **Never scope a propagation pass to a declared file list. Grep the whole tree for the wording of the reading being rejected.** The blind spots are consistent: Role Lens rows, Happy Path steps, copy strings, edge-case cells, Cross-Cut Notes, index/CX footers, and Deep Think rows restating a changed rule — agents edit Decisions tables and stop. Corollary: a verifier's finding list is a *sample*, not a complete set — always re-sweep after fixing what it listed.
- **Source**: 2026-07-23 propagation of 57 ratified decisions into the WeJammin ideation tree. Self-inflicted; the audit that produced the decisions exists precisely to catch stale downstream copies, and the propagation reproduced the defect while fixing it.

### PAT-008: An agent asked to apply a decision will invent the value the decision withheld (2026-07-23)

- **Timestamp**: 2026-07-23T03:06:00.000Z
- **Agent**: claude
- **Source**: audit-ambiguity
- **Tags**: pattern, anti-pattern, propagation

- **Type**: anti-pattern
- **Confidence**: 0.6
- **Context**: Applying a decision that deliberately defers a value (an instrument name, a threshold, an enum) to a later pipeline stage.
- **Pattern**: A propagation agent rewriting a Happy Path to match a new decision filled the deliberately-empty US statutory profile with an invented `23:00` operating-hours limit and `98 dB`, complete with "each carrying the issuing authority" — plausible, well-formed, and contradicting **two** ratified decisions at once (one deferred the instrument names; the other says that profile declares no such instrument at all). The pressure is grammatical, not careless: prose needs a noun, and "the slot deferred to a later stage" reads worse than a number. **Make "did anyone fill in a value a decision deferred?" an explicit, separately-reported verification check** — it will not surface as a contradiction, because the invented value is internally consistent. The fix instruction that works: name the SLOT, never an instrument.
- **Source**: 2026-07-23 propagation; caught by the independent verify pass, removed in a third cleanup pass.

### PAT-009: Main loop completes a subagent phase the session limit dropped (2026-07-23)

- **Timestamp**: 2026-07-23T19:08:13.240Z
- **Agent**: claude
- **Source**: expired-deferral-triage
- **Tags**: pattern, best-practice, session-limit, audit, triage

### PAT-009: When a subagent Workflow dies on the session limit, finish its deterministic parts in the main loop (2026-07-23)
- **Type**: best-practice
- **Confidence**: 0.6
- **Context**: A large Workflow (triage + 177-unit check phase) died mid-run on `You've hit your session limit · resets 9am (America/New_York)`. The main loop is NOT subject to the same cap and kept operating.
- **Pattern**: Before declaring "blocked until reset", split the dropped phase into deterministic sub-jobs the main loop can do with code/Read/Edit, and only defer the parts that truly need parallel judgment. Concretely, three moves paid off: (1) the check phase's most important job — "does any 'already answered' row cite a fabricated D-NN?" — is a pure citation-existence check; done in code it found 0 fabrications across 770 struck rows (resolve same-file, then dotted spec-number refs like `05.01.03 DT-01`, then the CQ canonical namespace). (2) The residual "142 expired rows" were 87% measurement artifact: 123 were already-resolved rows whose Deferred-To cell cosmetically retained the completed stage name; only 19 were genuinely open. Always split resolved-cosmetic from genuinely-open before assuming unfinished work. (3) Hand-triage the small genuine remainder (19 rows) directly. Only the semantic re-check of bucket-A resolutions and the fresh full `/audit-ambiguity` truly needed the reset.
- **Source**: expired-deferral triage, run wf_884d11c7-65a. Related: [[BLOCKER-009]], PAT-006 (raw-record durability), PAT-007 (domain-wide scope).

### PAT-010: a contradiction with no open marker is a real finding class (2026-07-29)

- **Timestamp**: 2026-07-30T00:38:30.702Z
- **Agent**: claude
- **Source**: propagate-decision (DQ-R2-01)
- **Tags**: pattern, audit, triage

- **Type**: best-practice
- **Confidence**: 0.6
- **Context**: Triaging audit findings in the ideation tree, deciding whether a flagged unit is a
  genuine gap or a stale artefact.
- **Pattern**: PAT-008 established that some findings are **stale parent-CX markers** — the [DEEP]
  child already answers what the parent still flags as pending. DQ-R2-01 is the **inverse**: the
  parent asserted a confident identity ("scope IS the mandate") with **no marker at all**, while the
  child omitted the axis entirely. So "does it carry an open marker?" is not a sufficient triage
  test in either direction. The reliable test is **satisfiability**: take the document's own claim
  literally and try to instantiate it. Here, "scope is the mandate" plus a closed seven-value enum
  plus a five-value scope list is unsatisfiable on arithmetic alone — provable without judgement.
  Findings on units whose only open questions point elsewhere deserve *more* scrutiny, not less:
  a silent contradiction has nothing tracking it.
- **Source**: DQ-R2-01. `01.03.02`'s two [OWNER] questions were commission (`:97`) and on-platform
  signing (`:98`) — neither was the gap. Four adversarial agents attempted five refutations; all
  five failed.

### PAT-011: verify a decision's affected-files list by grep, not by reading the decision (2026-07-29)

- **Timestamp**: 2026-07-30T00:38:30.702Z
- **Agent**: claude
- **Source**: propagate-decision (DQ-R2-01)
- **Tags**: pattern, propagation, anti-pattern

- **Type**: anti-pattern
- **Confidence**: 0.7
- **Context**: Propagating a ratified decision through the spec tree.
- **Pattern**: DQ-02 ratified the seven-verb enum, and its recorded affected-files list **omitted
  `01.03.02`** — the one file in 1,122 that names a competing scope vocabulary. The propagation then
  ran correctly against an incomplete target list, and the contradiction survived two full audit
  runs. **The failure mode is not a bad propagation; it is a bad target list.** Never derive the
  affected-files list from the decision's own text or from the prior propagation record — derive it
  by grepping the tree for every competing term the decision settles, then diff that against the
  recorded list. A decision that fixes a vocabulary must target every file using **any** vocabulary
  in that slot, not just files citing the decision.
- **Source**: DQ-R2-01 root-cause analysis. Related: [[PAT-006]] (writing to derived artefacts
  instead of raw records) — both are cases of trusting a generated record over ground truth.

### PAT-012: Validate decomposition at both boundary and ledger granularity (2026-08-02)

- **Timestamp**: 2026-08-03T01:33:14.100Z
- **Agent**: codex
- **Source**: decompose-architecture
- **Tags**: pattern, decomposition, coverage, spec-graph

- **Type**: best-practice
- **Confidence**: 0.6 (applied 1 time)
- **Context**: Decomposing a deep fractal ideation tree into dependency-ordered IA shards.
- **Pattern**: Apply shard-load thresholds to direct approved subareas, then independently map every leaf feature through its top-level source prefix and verify total, Must, orphan and duplicate counts. Boundary counts alone can pass while leaf coverage is incomplete; ledger counts alone can hide overloaded boundaries. Also emit explicit wiki relationships because ordinary Markdown links do not satisfy the spec-graph edge linter.
- **Source**: WeJammin /decompose-architecture — 43 shards, 776/776 features, 230/230 Must, 35 deep dives, zero cycles and zero changed-artifact graph warnings.

### PAT-013: A uniform per-document evidence string is proof the audit did not run (2026-08-05)

- **Timestamp**: 2026-08-05T06:09:09.157Z
- **Agent**: claude
- **Source**: /audit-ambiguity ia
- **Tags**: pattern, anti-pattern, audit, verification

- **Type**: anti-pattern
- **Confidence**: 0.6
- **Context**: Reading any prior ambiguity-audit report before trusting its verdict.
- **Pattern**: `2026-08-03-ia-ambiguity-rerun-1.md` recorded 0/344 (0.00%) and cleared IA for `/write-be-spec`. Its per-document table repeats one identical evidence string — "8/8 rubric dimensions; implementer and adversarial checks pass" — for all 43 shards. A fresh run over the same 83 documents scored 19.48%, including 54 dangling cross-shard references detectable by a link check in seconds and present on that date. Treat an identical per-document evidence string across every row as a red flag that one verdict was copied N times, and treat that report's PASS as void rather than superseded. Corollary: run the cheap deterministic checks (link resolution, section presence, table-schema uniformity, reference reciprocity) before or alongside any semantic audit — they are exhaustive, they cannot be faked, and they calibrate whether the semantic pass is credible.
- **Source**: fresh IA audit 2026-08-05 contradicting the 2026-08-03 PASS.

### PAT-014: Calibrate a deterministic screen against real doc conventions before trusting its flags (2026-08-05)

- **Timestamp**: 2026-08-05T06:09:09.158Z
- **Agent**: claude
- **Source**: /audit-ambiguity ia
- **Tags**: pattern, best-practice, tooling, audit

- **Type**: best-practice
- **Confidence**: 0.6
- **Context**: Running any regex or structural sweep across a spec layer.
- **Pattern**: The first screen of the IA layer flagged all 43 shards, and nearly every flag was false: it searched for a `User Interactions` heading (the real one is `Interactions`), matched `Then` case-sensitively when the ACs use lowercase `then`, and treated `skeleton`/`placeholder` as lazy markers when they are Changelog rows and a real rig-member domain concept. A separate regex missed 54 genuinely broken links because it only matched paths prefixed `./` or `../`, skipping same-directory links. Before reporting screen output as findings, open two or three sample documents, confirm the actual conventions, and re-run. A screen that flags 100% of inputs is measuring itself, not the corpus — and one that flags 0% may simply be looking in the wrong place.
- **Source**: IA audit 2026-08-05, both failure directions hit in the same session.

### PAT-015: compile.mjs rewrites every file under .memory/wiki/specs/ — never park a working document there (2026-08-05)

- **Timestamp**: 2026-08-05T07:28:19.253Z
- **Agent**: claude
- **Source**: /resolve-ambiguity all ia
- **Tags**: pattern, anti-pattern, tooling, memory-pipeline

- **Type**: anti-pattern
- **Confidence**: 0.6
- **Context**: Writing any generated or working document anywhere under `.memory/wiki/specs/`, including `specs/audits/`.
- **Pattern**: `.memory/pipeline/compile.mjs` invokes `.memory/pipeline/spec-graph.mjs`, which rewrites every Markdown file under `.memory/wiki/specs/` to inject an auto-generated `## Related Specs` footer. `specs/audits/` is not exempt — `compile.mjs` classifies it as `'audit'` and still processes it. A 250 KB remediation worklist written to `specs/audits/` was silently rewritten to 159 KB by the next compile, dropping 11 of its 34 gap sections. The loss was invisible: the file still parsed, still looked complete, and the truncation was only caught because a downstream agent reported a missing section. This is the same failure class as PAT-006 (hand-edits to derived wiki files destroyed by compile), but wider than PAT-006 states — it is not only the three derived files `patterns.md`/`decisions.md`/`blockers.md` that compile owns, it is the whole `specs/` tree.
- **Rule**: working documents, worklists and generated reports intended to survive go outside `.memory/wiki/specs/` — `.memory/pipeline/progress/` is safe and is where the IA remediation worklist now lives. If a document must sit under `specs/`, re-verify it after every compile by checking a structural invariant (section count, heading count, byte size), not by eyeballing it.
- **Corollary**: a spec whose `## Related Specs` block is marked `<!-- spec-graph: auto-generated -->` must never be hand-edited there; edit the source relationships and re-run compile instead.
- **Source**: IA remediation 2026-08-05 — compile run to land DEC-098/099 silently truncated the worklist that the apply pass then consumed.

### PAT-014: Calibrate a deterministic screen against real doc conventions before trusting its flags (2026-08-05)

- **Timestamp**: 2026-08-28T00:00:00-04:00
- **Agent**: codex
- **Source**: /audit-ambiguity ia fresh rerun
- **Tags**: pattern, best-practice, tooling, audit

- **Type**: best-practice
- **Confidence**: 0.7 (applied 2 times)
- **Context**: Running regex and structural sweeps across a specification layer.
- **Pattern**: Calibrate each deterministic check against actual document conventions before scoring. This rerun initially over-reported missing acceptance criteria because interaction IDs differ from acceptance IDs by design, and over-reported cross-shard reciprocity because DEC-098 inbound-command acknowledgements intentionally cite the local protected surface rather than a caller-owned contract. Comparing ordered flow/criterion pairs and reading the locked caller/callback boundary refuted those flags, while balanced-backtick, Markdown-column, and resolved-anchor checks exposed three real score cells.
- **Source**: IA fresh audit 2026-08-28; 83 documents and 344 score cells.

### PAT-014: Calibrate a deterministic screen against real doc conventions before trusting its flags (2026-08-05)

- **Timestamp**: 2026-08-28T00:00:00-04:00
- **Agent**: codex
- **Source**: /audit-ambiguity ia fresh rerun
- **Tags**: pattern, best-practice, tooling, audit

- **Type**: best-practice
- **Confidence**: 0.7 (applied 2 times)
- **Context**: Running regex and structural sweeps across a specification layer.
- **Pattern**: Calibrate each deterministic check against actual document conventions before scoring. This rerun initially over-reported missing acceptance criteria because interaction IDs differ from acceptance IDs by design, and over-reported cross-shard reciprocity because DEC-098 inbound-command acknowledgements intentionally cite the local protected surface rather than a caller-owned contract. Comparing ordered flow/criterion pairs and reading the locked caller/callback boundary refuted those flags, while balanced-backtick, Markdown-column, and resolved-anchor checks exposed three real score cells.
- **Source**: IA fresh audit 2026-08-28; 83 documents and 344 score cells.

### PAT-014: Calibrate a deterministic screen against real doc conventions before trusting its flags (2026-08-05)

- **Timestamp**: 2026-08-28T01:00:00-04:00
- **Agent**: codex
- **Source**: /audit-ambiguity ia fresh rerun 1
- **Tags**: pattern, best-practice, tooling, audit

- **Type**: best-practice
- **Confidence**: 0.8 (applied 3 times)
- **Context**: Running regex and structural sweeps across a specification layer.
- **Pattern**: Calibrate deterministic checks against actual document conventions before scoring. This independent rerun treated pipes inside inline code as content rather than Markdown delimiters, allowed both locked interaction-table shapes, and evaluated deep-dive decisions with their owning shard. Those calibrations eliminated screen-generated false positives while preserving exact coverage, flow, contract, edge-case, and acceptance checks.
- **Source**: IA fresh rerun 1 on 2026-08-28; 83 documents and 344 score cells.

### PAT-016: Operational truth must be server-owned and fail closed (2026-08-30)

- **Timestamp**: 2026-08-30T06:08:13-04:00
- **Agent**: codex
- **Source**: /implement-slice Phase 1 Slice 01
- **Tags**: pattern, best-practice, security, operations

- **Type**: best-practice
- **Confidence**: 0.6 (applied 1 time)
- **Context**: Server-rendered health, readiness, degraded-state, and operator diagnostic surfaces.
- **Pattern**: Never render query parameters or ordinary request headers as authoritative system state or last-known-good freshness. Derive operational truth from a server-owned boundary; until that boundary is composed, render the explicit degraded/unknown state and omit unverifiable freshness. Keep public responses provider-neutral and require named capability, fresh step-up, reason, and successful audit persistence before private diagnostics.
- **Source**: Phase 1, Slice 01 implementation and adversarial review.

### PAT-017: Generated artifacts need check-only validation outside broad format globs (2026-08-30)

- **Timestamp**: 2026-08-30T06:08:13-04:00
- **Agent**: codex
- **Source**: /implement-slice Phase 1 Slice 01
- **Tags**: pattern, anti-pattern, tooling, generated-artifacts

- **Type**: anti-pattern
- **Confidence**: 0.6 (applied 1 time)
- **Context**: Deterministic OpenAPI/database artifacts and repositories containing protected or historical Markdown.
- **Pattern**: Avoid broad formatter globs that rewrite unrelated protected documents or generator-owned JSON. Give each generated artifact a deterministic `--check` command that compares source-derived bytes without writing, exclude that artifact from generic formatters, and format only the new documentation scope. If a broad formatter is run accidentally, reverse only its explicit unrelated file set before continuing.
- **Source**: Phase 1, Slice 01 validation gate.

### PAT-018: Consumer fixtures cannot prove that required authority producers exist

- **Timestamp**: 2026-10-01T20:56:13Z
- **Agent**: codex
- **Source**: phase-02-slice-09-activation-re-audit
- **Tags**: pattern, anti-pattern, acceptance, security, pipeline

- **Type**: anti-pattern
- **Confidence**: 0.6 (applied 1 time)
- **Context**: Slice acceptance and dependency advancement for protected CMS operations.
- **Pattern**: Do not close a criterion merely because a consumer/RPC passes against hand-built binding, review, or approval rows. Trace every required authority/evidence input to its real application producer and exercise the composed path. A recorded green checkpoint is not sufficient if fixtures silently supply missing upstream behavior. Reopen contradicted criteria and preserve dependent code without promoting acceptance. Local production-built UI fixtures may prove scoped presentation behavior, but never hosted MFA, review provenance, or successful protected activation.
- **Source**: Owner challenged why Slices 10/12 began before Slice 9 was complete; the 2026-09-30 re-audit superseded the recorded 279/279 checkpoint with 261/279.

### PAT: Marker-presence evidence over-claims acceptance (2026-10-02)

- **Timestamp**: 2026-10-02T22:05:55.967Z
- **Agent**: claude
- **Source**: implement-slice (Slice 09 evidence audit)
- **Tags**: pattern, evidence, anti-pattern

- **Type**: anti-pattern
- **Confidence**: 0.5
- **Context**: closing hundreds of criteria by tagging test titles with criterion markers and merging lane evidence files.
- **Pattern**: an independent refutation audit of 164 of 953 newly checked Slice 09 criteria found about 38% with an unproven clause and about 5% contradicted (failing marked tests, stubbed error conditions, per-file pass counts copied onto every criterion, merge dropping other layers files, rewording criteria to fit tests). Require: proofs that produce the condition through the real path, one assertion per clause, per-criterion observed text, a guard that checks results not just marker presence, and a separate-population audit before any criterion is marked done.
- **Source**: Slice 09 acceptance audit reports/s09-acceptance-audit.md.
