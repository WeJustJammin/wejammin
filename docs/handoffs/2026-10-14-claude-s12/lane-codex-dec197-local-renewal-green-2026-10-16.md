# DEC-197 local owned-reset renewal GREEN author handoff

Native `gpt-6.1-sol` / `ultra`. Author implementation **UNRUN**. Exact four-path
Dispatch claim only; protected primary checkout untouched. Root owns formatting,
behavior/regression runs, independent review and genuine native acceptance.

## Authority and RED

- Approved contract: `briefs/codex-dec197-upgrade-reset-identity-renewal.md:5–24`
  and `briefs/codex-dec197-renewal-contract-plan.md:14–100`.
- Read the complete 143-line contract plan, 246-line renewal fixture and frozen
  387-line local renewal test, plus current local prefix/target/inventory/staging
  implementation. Coordinated the complete A0 and exact recovery DTO with the
  independent pure-target/runner author; did not edit that author's files.
- Root supplied genuine 14-case local RED, independent TEST review CLEAR, before
  this GREEN release. This author did not execute or independently reproduce RED;
  no receipt pathname/hash was supplied with that release message.
- TDD/debugging/verification skills kept implementation downstream of observed
  RED and prevent a passing or native-acceptance claim from source review alone.

## Implemented boundary

- `delivery-receiving-upgrade-local-prefix.mjs:40–49` retains synchronous exclusive
  admission across prepare/reset/restore and awaits complete operation settlement.
  Authority remains the original A0 identity, original lease and separate immutable
  prefix/baseline digests (`:52–75,95–121`), not a returned renewal DTO.
- NEW `delivery-receiving-upgrade-local-reset-state.mjs` owns private ready,
  pending, case, recovery-only and restored states. Fixed prefix/1 and baseline/2
  registration precedes staging mutation; the handle, method bindings, prior
  identity/epoch, inventory copies and original failure remain private. No legacy
  `process.run` reset fallback exists. Reused handles and repeated recovery
  consumption refuse; the existing outer admission gate refuses overlap.
- `local-target.mjs:244–258` requires all three explicit native process methods:
  `beginOwnedReset`, `completeOwnedReset`, `proveRecoveryOwnership`. The narrow
  candidate observer (`:260–275`) independently rechecks the sealed logical ALT
  target, four-FD lease/config, actual container and PostgreSQL metadata. Only
  container/cluster may renew; observed initial database OID, owner and every
  other nonsecret DB metadata field remain invariant. No secret GUC value is read.
- Successful adoption additionally binds the raw completion's prior and candidate
  identities and inventory to the same private pending operation, verifies frozen
  source/080/config/seed inventory, complete staged bytes/inodes and exact applied
  version/name history, and validates the closed transition through the independent
  `assertResetTransition`. The private current anchor then becomes A1 or A2.
- Ordinary `createTargetGuard` is unchanged and strict. Staging callbacks use the
  accepted current anchor; there is no `allowDrift` option or caller identity
  replacement. A0 is never overwritten. Epochs label accepted transitions only;
  hashes, timestamps, DTOs and object handles do not themselves prove provenance.
- A nonzero, thrown or ambiguous prefix completion retains its pending handle.
  Recovery first awaits the same captured native ownership/drain method, then
  independently repeats candidate/source/lease/envelope/stage/history proof.
  Only this creates a recovery-only anchor with `resetEpoch:null`. Baseline/2
  links from it and returns the exact five-field `recoveryAttempt` diagnostic.
  The already-failed runner branch preserves the original error and no receipt.
- Unproved candidates/drain/ownership, post-case drift, altered source/lease/owner/
  OID or mismatched native inventory refuse without another reset. An uncertain
  pending native operation forbids even staging cleanup mutation. Baseline and
  cleanup errors never become success; the first thrown value is preserved,
  including a non-Error/undefined value. Restored state requires successful cleanup.

## Retained algorithms and scope

Inventory discovery/hash encoding/applied-history verification, staging byte and
inode checks/owned-link restoration, session SQL/argv/stdin/TAP/070 handling and
all tests/fixtures remain unedited. The local-target change only appends native
port validation and the candidate observer; its ordinary guard body is untouched.

New import DAG: prefix → reset-state → local-inventory → local-target → local-child
→ pure target; reset-state also imports local-target/pure target. No cycle, host
filesystem/process defaults, environment access, CLI entry point or native bridge
was introduced. README is frozen and not edited by this claim.

## Explicit limitations and next root gates

This is an injected-boundary implementation, not native ownership proof. The native
port's private operation registry must independently bind actual daemon, executable,
sanitized environment, lease, controlled recreation and backend/descendant drain.
Its raw completion DTO is only checked against independently observed local facts;
matching names, hashes, status0 or JSON cannot replace that native provenance.

Recovery is deliberately conservative: an unchanged candidate needs exact prior
history; a recreated candidate needs the exact attempted inventory history.
Incomplete/missing applied-history catalogs require manual recovery and no passing
receipt. This does **not** clear full failed-mid-reset automatic restoration.
Root reserved separate TEST-first partial/absent-history coverage if required.

Old legacy-only positive local fixtures have no owned-reset methods. They require
separately claimed compatibility changes; no mutating fallback or frozen-fixture
edit was made here. Root next: normalize, run new local14 plus pure28, cascade and
rerun existing local/main compatibility, scoped lint, independent review, then
separate host/native provenance and real negative/positive/restoration gates.

No author parser, formatter, import, test, runtime, DB/Docker/network/process or
Git command was run. Source was read/compared/hashed only; edits used apply_patch.

## Pre-normalization freeze manifest

Paths below are relative to the active Slice12 worktree. Root's formatter-only
preview reported normal sizes prefix145 / target275 / reset-state296, all <=300;
no root formatting edit had occurred at this author snapshot.

| Path under `infra/database-upgrades/` | Physical lines | Bytes | SHA-256 |
| --- | ---: | ---: | --- |
| `delivery-receiving-upgrade-local-prefix.mjs` | 139 | 3986 | `a5a409721c4b203cf88d4e76197511243c2f4f58abf426b2bd09736df06546e1` |
| `delivery-receiving-upgrade-local-target.mjs` | 275 | 9275 | `c6fd1cef4d4777228cc2c489ae2450f4b93cf594d8077c4a83e0d6bfa97a2166` |
| `delivery-receiving-upgrade-local-reset-state.mjs` | 218 | 8038 | `0ed62aea0424129ffc5658075e19df161718e6040636558aed30148ef98f3ce4` |

Line citations above refer to this unformatted author snapshot. Root normalization
will change textual hashes/line positions without expanding author runtime claims.
