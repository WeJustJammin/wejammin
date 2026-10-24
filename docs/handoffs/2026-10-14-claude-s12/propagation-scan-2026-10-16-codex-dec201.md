# DEC-201 restore-parent propagation — 2026-10-16

Owner answered `Remap by parent path for restore (Recommended)` at17:11:09Z.
Canonical DEC-201 was written immediately before downstream edits or implementation.

## Locked effect

- Restore selects newest-per-path first, then active-only eligibility.
- Resolve each recorded parent within source owner/revision to its logical path;
  reconnect to the fresh copy of that path's newest eligible active parent.
- Historical P1 to selected P2 is valid. Excluded parent or collapsed logical cycle
  refuses the complete restore atomically, with no fabricated/dropped/detached topology.
- Preserve fresh identities, parent-first insertion, immediate carry provenance,
  source immutability, registry/template checks and existing security/error boundaries.
- Ordinary DEC-198/200 active/pending carry is unchanged. No public field, status,
  permission or error reason is added.

## Applied source cascade

- `.memory/wiki/decisions.md`: DEC-201 and logical unique decision summary201.
- BE03c receiving obligation2: explicit restore selection and parent remap.
- Phase2 plan and Slice12 tracker AC243: matching receiving criterion; still unchecked.

BE03b2087 and IA deep-dive350 specify revision parents and restore chain, not a
contrary composition-parent rule; no change required. Existing DEC-200 remains
explicitly ordinary append/resolve-only. FE restore consumes the same command and
existing refusal contract; no frontend/public-contract expansion is required.

## Validation / receiving

Implementation427/428 remains unreleased until restore-only TEST discriminators,
meaningful root RED and independent review. Baseline full carry486 on509 has468PASS
and18 known restore failures. This propagation is not implementation, migration
promotion, a gate waiver, an AC tick or phase acceptance.
