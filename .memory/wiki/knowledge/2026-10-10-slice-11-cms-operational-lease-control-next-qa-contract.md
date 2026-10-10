---
id: 2026-10-10-s11-cms-lease-control-tdd
type: knowledge
agent: codex-gpt6.1-ultra
source: docs/handoffs/2026-10-08-phase2-codex-handoff/s11/lane-s11-native-cms-lease-control-tdd-2026-10-10.md
timestamp: 2026-10-10T11:10:52.931Z
---

# Slice 11 CMS operational lease control next QA contract

**Tags**: phase2, slice11, cms, heartbeat, lease, tdd

Selected derived operational TDD contract; QA and producer UNRUN. Fresh injected clock, existing Boolean heartbeat, actual server-returned version/expiry, serialized checkpoint, frozen initial receipt, close admission then drain accepted work, lost precedence before manual review and final CAS. Conditional CMS-only present-control forwarding preserves ordinary one-argument callbacks and never appends undefined. Separate three-new-file QA scope includes actual dispatcher forwarding and close/drain late-call non-poisoning witnesses. Canonical reader is token-blind; observed candidate metadata is NOT stage ownership. No new token reader, RPC, grant, security mode or recovery policy. Atomic current Job token/version/native expiry/origin/restore/fresh post-lock SQL stage fence is still required before production prep wiring; unselected and unproven. Two source-only reviews found this foundation compatible after forwarding and close/drain clarifications. Acceptance0/122.
