# DEC-203 lease output normalization propagation scan — 2026-10-19

Status: user-approved bounded decision; documentation correction applied, implementation and acceptance OPEN.

## Decision and authority

Direct user approval on 2026-10-19 permits I to normalize only its exclusively owned,
held/named-inode-verified lease-addon FD to0600 after proven GCC settlement.
Creation remains0600; the only intermediate full regular-file modes are0100600,
0100601,0100610,0100611,0100700,0100701,0100710,0100711. Exact final lease0600,
identity/UID/size/hash/0700 directory guards and independent RO handoff before load
remain mandatory. No named chmod, replacement, source override, new production
signal, service or default-stack authority.

The separately approved emergency cleanup was limited to the five original PR01
process instances. It does not authorize signals in future runs or change protocol
cancellation. Forced exit is not native validation acceptance.

## Scope and source-first scan

- Direct override: private runtime/build-output binding, not a new product policy.
- All14 currently pinned native-binding documents scanned for chmod/output-mode references.
- Additional rg scan covered .memory/wiki/specs and this Slice12 handoff tree:
  18 hits, including11 historical checkpoint lines,4 unrelated SQL editorial-lease
  references,1 historical owner-chmod summary,1 shared-lock rule and1 current binding.
- Historical receipts/checkpoint statements are preserved as dated evidence,
  superseded by the current decision; unrelated SQL lease behavior is unchanged.

## Classification

| Current target | Classification | Required action |
| --- | --- | --- |
| Runtime binding, old owner-only chmod / lease-stays0600 paragraph | Explicit contradiction | Authorize only I's owned lease FD normalization; distinguish initial/intermediate/final modes. |
| Green brief, R:67–142 diagnostic reference | Implicit brittle line reference | Use the existing closed-read-only-stdout-records anchor; no diagnostic-schema change. |
| Green brief, old Pending runtime R source-basis row | Explicit stale source identity | Replace superseded145LF/0ad6 source identity with current168LF/f8c5 binding; keep acceptance and original-manifest boundaries. |
| resources validateCompiledMode lease-only0600 | Implementation contradiction | TDD update to the exact finite intermediate set for both phases; strict phase/arity/type retained. |
| files sealFiles owner-only fchmod | Implementation contradiction | After proved settlement and existing checks, held-FD normalization to owner0700/lease0600 only. |
| Pure mode tests OM03/OM04 lease expectations | Implementation test contradiction | RED first: lease intermediate modes accepted before normalization; initial creation remains strictly0600. |
| profile.h initial0600/final owner0700 constants | Consistent | Preserve unchanged. |
| Shared lock no-chmod/no-unlock and native signal limits | Consistent | Preserve unchanged. |
| Final lease artifact/adoption0600 and RO guards | Consistent | Preserve unchanged and prove through real PR01. |

## Evidence and next gates

Prior real GCC probe changed same-inode owner output0600 to0711. Retained PR01's
actual I-held FD32 and named lease output matched dev56/ino3159102/UID1000 and0711.
The latter was rejected before native issue by the old lease-only600 predicate.
Cleanup receipts show TERM-only exit of the exact approved five targets, all old
/proc entries absent and all four locks released; run artifacts remain.

No mode-policy unit test, static review or cleanup substitutes for compiler
fence/drain, actual native close, PR01–04, bridge/native080, isolated DB or hosted
acceptance. Those gates remain OPEN.
