# DEC-197 local upgrade validation — approved reset-only identity renewal

## Human approval — 2026-10-16

The human explicitly approved: **Allow verified reset-only identity renewal**.

The approved question was: “May I update the local upgrade-validation protocol to renew container/cluster identity only after its own locked, verified Supabase reset, while still rejecting every unexpected identity change? Actual reset testing confirms the current fixed-identity rule cannot pass.”

This is a narrow amendment to `codex-dec197-upgrade-alt-reset.md`, not permission to weaken migration acceptance or adopt an unrelated database. The original physical-identity rule remains fail-closed except at the runner's own verified reset boundary.

## Evidence requiring the amendment

Under the four canonical locks, the normal exact ALT CLI reset changed container `b0f56248abd19795edbc55d6ba7bee55c024c2a8a6dbf0a6824d10da5d1df572` to `87621285c3fd03d4d20c7147cfd7d2f5586799d6d7ad348a5e92b04eb1924163`, and cluster `7697190935127949349` to `7697193352066895909`. Both databases had OID5. OID equality therefore does not establish physical identity retention.

Raw metadata receipts: `/tmp/wejammin-native-receiving-proto-red-BkaHbW/dec197-reset-identity-before.json` and `dec197-reset-identity-after.json`.

## Mandatory retained boundaries

- Renew identity only for an explicitly admitted reset owned, awaited and drained by this runner under all four verified locks; an unexplained replacement before, during or after ordinary observations is a refusal.
- Bind the exact logical ALT project/workdir, independently approved local Docker daemon, executable/configuration/environment and frozen complete migration/source inventory. No default stack, remote/hosted target, clone project, ambient selector or caller-supplied observation may authorize adoption.
- Independently observe actual physical identity before reset and after successful controlled recreation. Persist the reset epoch/transition provenance; subsequent setup, observation, migration and restoration clients bind the resulting identity and use fresh backends.
- Failed or ambiguous reset is not a successful renewal receipt. Drain owned client/backend work before attempting the separately authorized ordinary-baseline restoration; never overlap resets/restoration or guess that cancellation completed.
- Preserve negative 080 rollback proof, positive committed complete-catalog proof, actual source/witness bytes, strict SQL argv/stdin, old-row/ACL/role/sequence preservation, and verified ordinary-baseline restoration before publishing a receipt.
- New transition behavior requires contract-first meaningful RED, implementation, independent review and actual native verification. Existing 420 injected tests are not native reset acceptance.

## Current status

Approval recorded; no identity-renewal implementation or native upgrade acceptance is claimed here. Update the detailed protocol and downstream contracts/tests before releasing the amended native gate. Production CMS behavior and external phase gates are unchanged.
