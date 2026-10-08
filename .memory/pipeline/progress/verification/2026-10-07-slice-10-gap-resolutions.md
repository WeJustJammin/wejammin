# Slice 10 gap-audit resolutions (2026-10-07)

Source: independent Opus gap audit of P2-S10-AC-001..105 against the repaired
continuation state (integration checkout `codex/phase2-slice10`, backup ref
`refs/backup/s10-integration-1`). The audit classified 15 criteria
implemented and tested, 6 with untested clauses, 45 partial, 2 missing, 11
contract-only and 26 write-path rows pending reclassification. No criterion is
checked by this document.

Precedence used for every item below: the locked acceptance-criterion text is
the contract; where BE/FE prose contradicts it, the prose is amended. Where a
criterion depends on an authority owned by a later, unbuilt slice, Slice 10
fails closed with a typed reason and the later slice receives the obligation.
These are orchestrator resolutions recorded as DEC-139..DEC-146; the owner may
override any of them.

| ID | Issue | Resolution | DEC |
|---|---|---|---|
| D-1 | AC090 requires a closed conflict to be an indistinguishable 404; BE03b:1166 returns 200 metadata-only. | Follow AC090: hidden, wrong-scope, closed and absent conflicts are one 404. Amend BE03b:1166. The editor treats 404 after a 409 as "conflict no longer open" and refetches the draft. | DEC-139 |
| D-2 | Cursor expiry/context mismatch: validation matrix and AC035 say 400; error matrix says 409. | Structural cursor faults (length, encoding, key set, malformed keyId/signature) are 400 `INVALID_REQUEST`; a well-formed cursor that is expired, tampered, signed by an unknown or stale key, or bound to another actor/context/filter is 409 `CONFLICT` with a safe restart recovery, for both CMS-03B-03 and CMS-03B-13 (the established Slice 09 history-cursor admission). AC035's "400" covers the structural row. | DEC-140 |
| D-3 | Taxonomy-version resolution in comparison/restore lineage has no Slice 10 authority. | Recorded taxonomy-version IDs are carried and compared by identity. A non-empty taxonomy-version reference that must be resolved fails closed with the typed unavailable reason until Slice 12 registers the provider; Slice 12 receives the resolution obligation. | DEC-141 |
| D-4 | Restore translation of composition instances and taxonomy term assignments; template/taxonomy IDs taken from the source. | Template and taxonomy version IDs come from the source revision (restore reinstates the source content under its recorded versions). A source revision carrying active composition instances or term assignments fails closed (409 `migration_chain_incomplete`) until Slice 12 authoring of those records lands; Slice 12 receives the translation obligation. | DEC-141 |
| D-5 | IA03 says the autosave 409 carries base/theirs/yours values; AC053 says preimages come only through CMS-03B-12. | Follow AC053: the 409 carries the conflict identity and versions only; preimages are read through CMS-03B-12. Amend IA03 CMS-05 wording. | DEC-142 |
| D-6 | No producer revokes entry assignments on authority loss; presence renewal cadence; sweep RPC absent from the Named RPC list. | Authority revocation (capability grant, membership tenure) revokes the affected person's active entry assignments in the same transaction as presence release (IA03 edge case). Presence is renewed by each authorized autosave (≤30 s while dirty); an idle editor's lease lapses after 2 minutes. Add the renewal path and `cms_expire_edit_presence_leases` to BE03b's Named RPC list. | DEC-143 |
| D-7 | AC078 requires strict kind-specific object-property constraints; spec types them as an open record. | Close the vocabulary by mirroring the field-level members per property kind: `scalar` → minLength/maxLength (string values) and minimum/maximum (number values); `enum` → required non-empty `enumValues` (+ optional minLength/maxLength); `rich_text` → minLength/maxLength over NFC text. Unknown members, wrong types and min > max are refused identically in TS and PostgreSQL; values are checked against them. No new vocabulary is invented. | DEC-144 |
| D-8 | Entry-list items carry `entryId` beyond BE03b `RevisionSummary`; FE03 renders lifecycle and updated time the contract lacks. | `EntryListPage.items` = `RevisionSummary` + `entryId`, `entryLifecycle`, `entryUpdatedAt` (server-derived, no owner/assignee identifiers). Amend BE03b. | DEC-145 |
| D-9 | BE03a object-structure path/count drift. | Already reconciled to `constraints.objectStructure.properties[]`, 0–32 (lane F). | — |
| D-10 | `contentHash` under field retirement. | `contentHash` is the JCS SHA-256 of the returned `fields` projection; the stored revision payload hash is verified over every stored value server-side. Amend BE03b. | DEC-145 |
| D-11 | Malformed UUID handling differs between pages (404), proxies (404/422) and Worker (400). | A structurally malformed ID is 400 `INVALID_REQUEST` at the proxy and Worker (BE03b:172), and the page renders its invalid-request state, never a not-found state. | DEC-145 |
| D-12 | AC085 needs a rich_text.v1 artifact reference and hash frozen into the schema artifact; none exists. | Implement it: a canonical immutable `rich_text.v1`@1 grammar descriptor with a JCS SHA-256 hash in the protected validator registry (TS and SQL), frozen into every compiled schema artifact that pairs the validator, and revalidated before every editorial transition. | DEC-146 |
| D-13 | Contract-only matrix defects (timezone grammar, audience grammar, `checkers` vs `checker`, 256-entry cap). | Timezone accepts IANA names including `UTC` and three-segment zones; audience is `^[a-z0-9_-]{1,48}$` (BE04c); the dependency manifest has one `checker` entry and a 256-entry total cap. Amend BE03b matrix rows. | DEC-145 |
| D-14 | AC020 says "comparison-unavailable" for >512 changes; spec token is `comparison_too_large`. | The >512 refusal is 422 `comparison_too_large`; an unresolvable recorded version is 422 `comparison_unavailable`. AC020's wording names the refusal family; evidence cites `comparison_too_large`. | DEC-140 |

Receiving obligations moved to Slice 12 (no criterion moved): taxonomy-version
resolution in Slice 10 comparison/restore lineage (D-3) and restore translation
of composition instances and term assignments (D-4).
