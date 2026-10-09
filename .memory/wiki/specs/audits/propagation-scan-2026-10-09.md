# DEC-162/163 propagation scan —2026-10-09

Owner directly approved both recommendations with "approve all". Approval was
flushed/compiled and pushed at17d93f00 before this read-only scan wave.
Parent and independent6.1/ultra reviewers inspected current source; no runtime
proof is claimed by this report. No broader policy/endpoint/authority is approved.

| Decision | Explicit contradiction                                                                                                                                                                                 | Implicit assumption                                                                                                                                                                  | Preserve                                                                                                                                            |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| DEC-162  | BE03a2097 non-null source DDL; Worker plan types6/23, record schema50–60 and output8/25 require/cast UUID strings                                                                                      | verification188/205 and rollback results336 forward source as expected active/fallback; IA03 CMS-04 prior-active clauses and deep-dive migration/restore models omit initial absence | DEC-108 real producer chain; FE03 pending projection; actual successor scans/transforms; existing authority/CAS/idempotency/lease/fingerprint gates |
| DEC-163  | BE03b E7 first evaluation records snapshot; installed017550:33/141 explicitly materializes reads;017560:21 and017570:49 repeat assumption; cold workflow apispec83 requires absence yet200 preparation | workflow inline-unavailable rule needs complete-manifest qualification; revision-trigger initialization would violate the existing leaf lock's later-row-lock precondition           | safe-read/no-effects rules; real entry CAS/If-Match and creation exception; historical replay; frozen dependency409/invalidation; CFG CAS unchanged |

## Important source limits

- Installed021830:50–78/220–221/479–495/800–821 returns zero for null
  source, compares live rows to null and pages with LIMIT0. Actual RPC traffic is
  not independent empty-scope proof. Guard the genuine candidate/type/owner and
  actually query affected persisted relations; recheck under sealing fences.
- A completed null-source first plan is not a restore edge. A later legitimate
  active UUID can be projected without reopening or switching. Before reviewed
  public activation no active version may exist.
- No dedicated CMS settings-save endpoint exists. Use ordinary authorized CMS
  revision-save tails; no new CFG hook or synthetic/zero snapshot CAS operand.
- Safe normal-write tails follow cms_complete and precede final return in
  05018040:431,05018045:647,05018050:713,05018055:560 and021670:326.
  Earlier replay returns stay earlier. Failure must roll back all effects.
- Existing frozen helpers convert rebuild failure to stale/false; do not replace
  their committed409/invalidation behavior with a universal503.

## Apply authorization

The owner approved these two policies and corresponding locked-contract changes.
Apply explicit contradictions individually, flag retained runtime gaps, refresh
the graph, then source-only native TDD and parent execution. This is not slice
closure;122 criteria and external release gates remain unchanged.
