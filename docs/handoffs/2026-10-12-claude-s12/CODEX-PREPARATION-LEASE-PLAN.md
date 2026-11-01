# Preparation exhaustion lease recovery — optional, unapproved proposal

## Locked outcome and cause

DEC-184 selects final-delivery terminal rollback with `MIGRATION_RETRIES_EXHAUSTED` and a recoverable
plan. BE03a:2484–2491 also explicitly states that a verifying plan cannot be re-leased and allows a
genuinely unreadable or unclaimable plan to remain, with Job failure and operator alerts. The current
expired-verifying `unavailable` result is therefore not an unconditional violation of that exception.
The private lease extension below is a proposed strengthening of recovery, not accepted implementation.
Root asked the owner to approve the amendment; no reply or GREEN authorization has been received.
Completion of the requested existing Phase 2 scope does not depend on approving this extension.
Until an explicit owner amendment, the locked fallback remains authoritative. Proposal diagnostics
are preserved separately, and active tests must assert that fallback rather than require re-leasing.

The claimed preparation exhaustion helper uses the stale stored token for `verifying` instead of
claiming a fresh lease. The latest lease claim excludes verifying; terminal rollback correctly
refuses expired tokens. The existing unit test explicitly pins the resulting unavailable state.
Do not relax rollback's lease check or fabricate a successful rollback result.

## Intended minimal correction

1. Preserve the claim RPC signature, grants, owner, security attributes, fingerprint, version and
   cursor checks. A forward migration may admit an expired verifying plan to a fresh CAS lease.
2. Preserve state `verifying`, cursor, counts, sealed report, source/target fingerprints and old active
   schema. Only the lease metadata, CAS version and update time advance; no new scan or row deletion.
3. Establish verification-lease expiry using fresh database time after the plan row lock, not a
   caller-provided future time. Never take another live owner’s lease, even with forged `now`.
4. The exhaustion helper should use the normal fenced acquisition path when its lease is unusable,
   including verifying, then terminal rollback with the returned fresh plan/version/token.
5. Keep the BE00 Job checkpoint before each RPC. Neither the RPC change nor unit simulator is proof
   that the production Job fence works: retain and run its boundary tests and real-stack proof.
6. Only after owner approval, the originating spec correction and cascade may change BE03a's inability
   sentence. Preserve terminal-failure/alert semantics for genuinely unreadable or unclaimable plans;
   actual recovery must then be proven GREEN before acceptance.

## Required tests before implementation

- Actual claim RPC: expired verifying lease grants fresh token while preserving verifying state and
  sealed evidence. Subsequent terminal rollback succeeds with the new CAS version and token.
- Actual claim RPC: another live owner is refused even if caller `now` is far in the future; no
  version, token, state, counts, audit/outbox or report change.
- Stale version/cursor/fingerprint request is refused with exact typed outcome and no effects.
- Old token cannot perform rollback after successful takeover; repeated stale claim cannot succeed.
- Terminal rollback admits a new dry-run attempt through the actual author command, not direct updates.
- Worker exhaustion path: read, claim and rollback requests use the returned fresh version/token;
  a lost Job checkpoint performs no subsequent RPC or mutation.

## Stage and ownership

QA-RED first. New forward migration range reserved: `20261013600000`–`20261013600999`.
It cannot overlap governed `202610133xxxxx`, pattern `202610134xxxxx` or taxonomy `202610135xxxxx`.
This plan does not claim a gate pass, change a public request/replay format or authorize a global
relaxation of expired leases. Root independently reviews production changes before integration.
