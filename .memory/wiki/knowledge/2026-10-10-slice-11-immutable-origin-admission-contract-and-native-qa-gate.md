---
id: 2026-10-10-s11-origin-admission-contract-native-qa-gate
type: knowledge
agent: gpt-6.1-sol
source: docs/handoffs/2026-10-08-phase2-codex-handoff/s11/lane-s11-native-origin-admission-tdd-2026-10-10.md
timestamp: 2026-10-10T08:19:28.245Z
---

# Slice 11 immutable origin-admission contract and native QA gate

**Tags**: phase-02, slice-11, native, origin-admission, contract, tdd, qa-gate

Corrected disjoint originEvent producer proof from9753ca21: request17/unit37277/verifier22/SQL142/API34557; old missingclaimedJob refusal restored without QA edits. Actual77unit/143SQL/135API local baseline. Eight actual verifier mutants O1–O8 caught with failed8/18/18/18/17/1/1/17 of77 at assertionlines208/109/110/98/93/237/226/85. Each exact23-SHA restore before actual77/77GREEN control; freshCI0/flock, other22 frozen, no QA edits/active mutant. Tracked JSON receipts saved; independent16-log review no bounded mismatch of counts/assertions/locations/CI/durations. O6 false-result precedes no-call assertion, not independent no-call-only witness. Historical preflight/SHA and exits root-captured. Fresh77GREEN1.32s and bounded contracts/db-types/progress/format/diff0. Four SQL-origin mutants UNRUN before next clean checkpoint, exactrestore23hash/full57GREEN controls required; consistent fixtures don't independently prove storedJobcorr/cause/payload guardremoval. No protectedrowcorruption, newRPC/signature/grant/owner/policy. Origin-only local proof: no currentauthority/race/lease/stage/receiving/ACK/hostedAuth/fullValidation/acceptance0/122. Earned-only resets automatic when needed/no purchases; latestusage52ordinaryallowed, earnedcountunexposed.
