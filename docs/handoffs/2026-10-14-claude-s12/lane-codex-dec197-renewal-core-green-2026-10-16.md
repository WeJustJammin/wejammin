# DEC-197 renewal core — author freeze, UNRUN

Native `gpt-6.1-sol` / `ultra`, 2026-10-16. Worktree:
`/home/rob/.codex/worktrees/phase2-slice12/WeJammin`.

## Authority, release and evidence boundary

The exact GREEN claim is recorded in Slice12 Dispatch:2875-2877. Only
`infra/database-upgrades/delivery-receiving-upgrade-target.mjs`,
`infra/run-delivery-receiving-upgrade.mjs` and this new report were changed.
The optional reset-transition extraction was unnecessary and was not created.
No tests, old fixtures, local/native modules, README, trackers or approvals changed.

Governing sources read in full:

- `briefs/codex-dec197-upgrade-reset-identity-renewal.md:5-24`: human-approved
  exception only for a runner-owned, locked, verified reset; mandatory drain,
  independently observed identity, restoration and retained acceptance proofs.
- `briefs/codex-dec197-renewal-contract-plan.md:14-46`: immutable A0, strict
  ordinary drift refusal, closed transition and distinct reset epochs.
- Plan:50-86: fixed exported seam, separate accepted case anchor, native/private
  ownership, unchanged source/session/outcome/catalog boundaries.
- Plan:88-100: failed reset is never successful renewal; recovery-only ownership
  and separate baseline restoration, otherwise fail closed/manual recovery.

Root reported actual new TEST RED: 74 cases, 6 PASS, 68 meaningful FAIL, no skips
or collection errors. It included the missing transition export, fixed-identity
refusal and missing local owned port. This report does not independently certify
that run or claim any subsequent GREEN. The author reviewed the new 28 pure and
14 local tests source-only before this implementation release; host32 is a
separate review domain. Existing successful legacy DTO fixtures require their
separately inventoried compatibility claim; none were altered here.

## Implementation

Target:170 adds the fixed API:

```text
assertResetTransition(value, {
  plan, initial, previous, purpose, sequence, inventorySha256
})
```

It requires complete initial attestation, purpose/sequence prefix1 or baseline2,
the separately authoritative prefix/baseline digest, exactly the 11 approved
transition fields and five-field from/to identities. Logical ALT target, owner
and observed initial database OID remain invariant. From matches previous;
output identity matches to; output epoch matches toEpoch. The previous epoch is
null for initial prefix or recovery-only restoration, otherwise the accepted
previous resetEpoch. The next bounded epoch is nonempty and distinct. Source,
witness and inventory hashes and the output inventory field must agree.

This checks diagnostic structure and links only. A matching DTO, hash or epoch
does not authenticate native reset ownership. Existing assertIdentity,
assertAttestation, assertReset, assertEnvelope and assertRestoration bodies are
unchanged. The original entire 5060-byte target module is an exact prefix of
the result; removing only the new function/comment separator yields original
SHA-256 `d465e7037df718a089ebde68e288204cd92e2c9612645346360be5b47a80909e`.

Runner keeps its existing deep-copy/freeze of A0 and every I/O observation. It
validates the prefix transition before storing the accepted case reset. All four
ordinary setup/before/migration/after envelopes compare strictly against A1/E1,
not obsolete A0 physical identity. Existing session uniqueness, observer database,
source/080/plan rechecks, outcome, negative rollback and positive catalog checks
remain in the same order. Initial OID remains the migration-session comparison.

Restoration always receives the same immutable A0. Accepted prefix restoration
links A1/E1 to A2/E2 and refuses an unexpected recoveryAttempt. Only the branch
already holding an original failure and no accepted prefix may validate the
closed recoveryAttempt `{purpose,sequence,from,to,acceptedEpoch}`: prefix1,
from=A0, acceptedEpoch=null. Its recovery-only to identity must then match the
baseline transition from identity, with unchanged target/owner/OID. It is never
assigned to the case anchor or used to admit setup/migration.

The separately authored local adapter is responsible for the private opaque
pending handle, actual operation attribution, independent raw observation and
drain. The local author confirmed initial is the complete immutable attestation;
previous is A0 for prefix, accepted reset output for normal baseline, or the
independently proved recovery identity plus resetEpoch:null for recovery baseline.

Original errors survive restoration failure or successful recovery. Passing
receipts remain impossible after any primary/restoration failure. On success,
receipts retain existing fields plus initialIdentity, caseIdentity,
restoredIdentity and the ordered two resetTransitions; no history is overwritten.
All seven public upgrade API names and I/O method signatures remain unchanged.

## Static readback and raw manifest

Both modules were read back completely. Source-string inspection found no new
process/network/dynamic-import surface, tabs or trailing whitespace. Standard
expanded source remains below the 300-line production limit; no minification or
formatter execution was used. Pure/local TEST hashes remained unchanged from
their reviewed author freeze. No other files were authored in this task.

| Path | Lines | Bytes | SHA-256 |
| --- | ---: | ---: | --- |
| `infra/database-upgrades/delivery-receiving-upgrade-target.mjs` | 260 | 7985 | `e364b96ebb0c13593ca5548d4a3936fde9a39f5ff2d8fcea1c36f10fdac0e6b1` |
| `infra/run-delivery-receiving-upgrade.mjs` | 236 | 7373 | `a1f853ae12d8d629485cabe080b48fbfcba6d8ea29640c68cbb3347a9013ed20` |

Report self-hash is supplied externally. Author **UNRUN**: no parser, formatter,
test, runtime/import, native process, database, network, Git or CI execution.
Root owns normalized checks, focused new28 and legacy compatibility gates,
independent review and all real four-lock native attribution/restoration proof.
Neither this implementation nor injected tests establish native reset acceptance.
