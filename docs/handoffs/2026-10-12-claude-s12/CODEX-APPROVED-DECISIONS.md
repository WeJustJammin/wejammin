# Owner approvals — 2026-10-13 12:27 EDT

Direct user instruction: **“approve both and resume”**.
This approves the two recommendations in the preceding request:

1. Preserve immutable governed-definition versions and historical pins; introduce
   a separate lifecycle concurrency/event counter. Correct the originating locked
   wording and cascade the decision before affected implementation.
2. Preserve the 1–512-row CMS03C02 placement contract; allow a **CMS03C02-only,
   response-only 1 MiB ceiling**. Requests and unrelated routes remain at 256 KiB.
   Derive and validate the actual producer's maximum serialized response; approval
   does not itself prove every permitted placement fits the ceiling.

The goal has resumed as active. Requested model routing remains
`gpt-6.1-sol` / `ultra` for orchestration and
`Phils-Charm/deepseek-v4.1-flash` / `high` for execution.

This is not approval of expired-verifying re-lease, a public version/pin redesign,
a universal response-limit increase, reduced placement cardinality, skipped gates,
or acceptance closure. Existing lease fallback and external gates remain intact.

Implementation and validation remain incomplete. The specification correction,
downstream cascade, contract-first tests, independent review and required gates
must still be performed and recorded.
