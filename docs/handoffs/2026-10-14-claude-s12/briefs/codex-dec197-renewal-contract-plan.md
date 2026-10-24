# DEC-197 reset-only identity renewal — bounded contract plan

Native `gpt-6.1-sol` / `ultra`; source-only, **UNRUN**. This file proposes the
contract/test cascade, not implementation or native execution authority.

## Authority and retained invariants

The human-approved addendum is `codex-dec197-upgrade-reset-identity-renewal.md:5–24`;
canonical record is `.memory/wiki/decisions.md:5337–5342`. Actual normal reset
changed container and cluster while both database OIDs were5. OID5 is not continuity
proof. Only a runner-owned, locked, verified reset may renew physical identity.
Every ordinary observation still refuses drift; no default/remote/clone adoption.

Keep immutable initial attestation `A0`, sealed logical ALT target, initial owner
`postgres`, nonsecret database envelope, exact daemon/executables/environment,
four-FD lease, complete frozen inventory, source/080 byte binding and separate
prefix/baseline digests. Do not overwrite `A0` with a reset result. Conservatively,
the approved container/cluster exception does not relax database-OID equality to
the independently observed initial OID; no hardcoded5 substitutes for observation.

## Closed transition and private authority

1. `ready(A0)` → `pending(prefix, A0, P)` → `case(A1, E1)` only after owned reset
   completion, drain, independent candidate observation and exact applied `P`.
2. `case(A1, E1)` → `pending(baseline, A1, B)` → `restored(A2, E2)` requires the
   same proof, exact ordinary `B`, and a fresh epoch distinct from `E1`.
3. Any nonzero exit, signal, thrown/ambiguous completion, lost drain, ownership or
   postcondition is `uncertain(pending)`, never successful renewal. Only a private
   independently proved recovery anchor permits baseline restoration. Otherwise
   fail closed for manual recovery, retain diagnostics and publish no passing receipt.

The reset adapter keeps one private pending record before reset-phase mutation:
purpose, sequence, prior accepted identity/epoch, frozen inventory and digests,
initial authority, actual native operation handle and terminal state. Overlap,
replay, forged handles, wrong purpose, stale sequence and second consumption refuse.
No JSON flag, epoch string, random token, hash or caller-supplied observation proves
ownership. Digests bind bytes; epochs label state; neither authenticates a reset.

Proposed diagnostic `ResetTransition` has exact fields: `kind` fixed to
`DEC197_OWNED_RESET_V1`, `purpose`, `sequence`, `from`, `to`, `fromEpoch`, `toEpoch`,
`inventorySha256`, `sourceSha256`, `witnessSha256`. `from/to` are full identities;
initial `fromEpoch` is null. Target/owner/OID stay invariant; container/cluster may
renew here only. Output identity and epoch equal `to/toEpoch`; expected inventory
is `P` for prefix or separately captured `B` for restoration. This DTO is an audit
description, never native authority. Keep both transitions and initial/case/final
physical identities in the eventual receipt instead of rewriting history.

## Minimal signatures and implementation cascade — proposed, unreleased

- Keep seven public API names and existing I/O signatures, including
  `resetBefore(plan, A0)` and `restoreBaseline(plan, A0)`. Extend successful reset
  and restoration outputs with `transition`; all case envelopes bind `A1/E1`.
- In pure `delivery-receiving-upgrade-target.mjs`, retain `assertIdentity` strict.
  Add `assertResetTransition(value, { plan, initial, previous, purpose, sequence,
  inventorySha256 })` for closed shape/link/source/owner/epoch checks. It does not
  claim native provenance. Reset/restoration assertions use this boundary check;
  ordinary envelope assertions still compare the accepted case anchor strictly.
  Never add `allowDrift` to ordinary guards.
- In `infra/run-delivery-receiving-upgrade.mjs`, retain private immutable `A0` and
  separately track validated case `A1/E1`. Validate prefix transition against `A0`;
  compare setup/observers/migration to `A1`, not obsolete initial physical IDs.
  Successful restoration links from `A1` to `A2`; preserve original failure identity
  and mandatory restoration. Failed-reset recovery can never produce a passing
  receipt, even if baseline restoration subsequently succeeds. In that already-failed
  branch, validate the diagnostic chain from prior accepted identity through the
  failed pending attempt/recovery anchor to the baseline transition; never promote
  that recovery anchor into a successful case or accept it outside this branch.
- In local-prefix, own pending/current/recovery state privately. Freeze each stage
  and recheck source/authority before execution. After completion use a narrowly
  scoped candidate observer only through that pending operation; verify applied
  history/stage bytes and unchanged logical/nonsecret envelope before committing
  `A1` or `A2`. Ordinary `createTargetGuard(plan, pinned)` remains strict. An error
  path cannot pass arbitrary reset output back as replacement authority.
- In local-target, require the owned-reset native port through existing `process`
  dependency: `beginOwnedReset(request) -> opaqueHandle`,
  `completeOwnedReset(handle) -> Promise<rawCompletion>`, and
  `proveRecoveryOwnership(handle) -> Promise<rawRecoveryObservation>`.
  Registration precedes mutation; handles live in the native port's private registry.
  Raw observations must be checked against the pending prior identity, fixed command,
  daemon/executable/env/lease and frozen inventory, not accepted as self-attesting DTOs.
- In local-session/observer, retain exact SQL, argv/stdin, TAP-before-COMMIT, full070,
  fresh case-client PIDs and outcome/catalog semantics; bind to accepted `A1/E1`.
  Inventory hashing/applied-history and staging ownership algorithms do not change.
  Staging callbacks use accepted current authority, or the separately proved recovery
  anchor only during restoration. Local-child/native registry must drain raw probes,
  CLI descendants and owned Docker/PostgreSQL work before any next mutation.

## Failure recovery is not successful renewal

Keep the pending handle after an unsuccessful reset. If no recreation happened,
independently reprove the unchanged prior identity. If partial recreation happened,
require raw attribution of that exact candidate to the same owned operation before
using it as a recovery-only anchor. A reset exit0 plus matching name/labels, time
window, OID5, lock ownership or post-reset digest alone cannot distinguish a foreign
replacement. Native provenance must bind the actual controlled daemon recreation
result to the owned CLI/process operation; otherwise recovery is manual, not adoption.
Only then start a separate, nonoverlapping baseline operation. No successful prefix
epoch is manufactured for the failed attempt; retain its failure provenance and
the restoration transition. Lost locks/daemon/target or uncertain backend absence
forbid automatic restoration; do not reset a foreign replacement to make cleanup pass.

## TEST-first exact-path proposal and release order

Root should first claim these four NEW files under `tests/contracts/`:

```text
phase-02-slice-11-delivery-receiving-upgrade-renewal.test.ts
phase-02-slice-11-delivery-receiving-upgrade-local-renewal.test.ts
phase-02-slice-11-delivery-receiving-upgrade-renewal-fixtures.ts
phase-02-slice-11-delivery-receiving-upgrade-host-renewal.test.ts
```

Meaningful RED must include owned successful container/cluster change with OID
unchanged; ordinary drift rejection at every non-reset boundary; mismatched source,
baseline, epoch, owner, OID, from/to, lease, purpose and sequence; forged/replayed
handles; concurrent operations; status0 without native attribution; nonzero/timeout
after partial recreation; drain failure; recovery refusal for a foreign candidate;
verified recovery-only restoration with original error/no receipt; and restoration
failure after otherwise passing negative/positive evidence. Literal expectations
must not call the transition producer being tested. Keep old drift oracles intact.

After new RED, separately claim compatibility DTO/fixture updates in existing
`phase-02-slice-11-delivery-receiving-upgrade-target-fixtures.ts` and
`phase-02-slice-11-delivery-receiving-upgrade-fixtures.ts`; inventory further fixture
consumers before claiming them. Do not globally replace old identities or weaken
existing assertions to make renewal green. Root owns checks/runs and exact releases.

Native bridge order remains: attested absolute executable/package and sanitized
selector-free environment/dotenv policy → independently pinned local Docker daemon
→ live four inherited FLOCK FDs/owner ancestry → private owned-operation registry,
actual recreation attribution and backend drain → local transition implementation
→ independently reviewed root four-lock native negative/positive/restoration runs.
The proposed no-fork launcher still needs actual same-owner FD-survival proof.
Current injected tests and this plan establish no native reset acceptance.

## Source anchors and freeze

Current strict seams: `delivery-receiving-upgrade-target.mjs:80–166`;
`infra/run-delivery-receiving-upgrade.mjs:72–176`; local-prefix `:56–90,112–202`;
local-target `:169–240`; local-session `:52–90,217–246`; local-child `:20–95,240–244`.
Module basenames above are under `infra/database-upgrades/` unless prefixed `infra/`.
Only this plan is authored. No code/tests/approval/tracker edits, parser, formatter,
runtime, database, Docker, network or Git execution. Root reads before TEST release.
