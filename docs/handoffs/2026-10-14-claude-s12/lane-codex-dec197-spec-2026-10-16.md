# Lane: DEC-197 receiving-foundation spec cascade (Codex)

Task name: /root/phils_dec193_spec_20261015 (the DEC-197 receiving-foundation cascade ran under this task; DEC-197 names the decision, not the task).
Date: 2026-10-16 (report written 2026-10-16 UTC).
Model: Phils-Charm/deepseek-v4.1-flash / high (exact; no fallback used).
Status: **FROZEN / UNRUN — no acceptance claim.** All six files are written and frozen; root independent review is now active and all specs stay frozen.

## Authority and boundary

- Worktree: /home/rob/.codex/worktrees/phase2-slice12/WeJammin, HEAD b16edb54a7a1b698ed8ca15b6085046d4270626e. Primary /home/rob/Projects/WeJammin is READ-ONLY.
- Edits use apply_patch only; literal text, no JS replacement strings with `$ ` hazard; any TS fences kept well formed.
- Owner answer recorded in canonical DEC-197: "Complete contract and relationship now (Recommended)". The choices below are the root-selected implementation architecture under that authorization; they are not pre-existing locked facts and not a fresh owner decision.
- No actual Zod/SQL/tests/code/tracker/compile/runtime/git/network work. Root owns validation.

## Exact six writable paths (only these)

1. .memory/wiki/specs/ia/04-cms-delivery-media.md (IA04)
2. .memory/wiki/specs/ia/deep-dives/04-cms-delivery-media.md (IA04 deep dive)
3. .memory/wiki/specs/be/04a-navigation-routes-discovery.md (BE04a)
4. .memory/wiki/specs/be/04c-public-delivery-cache.md (BE04c)
5. .memory/wiki/specs/phases/phase-2.md (phase plan)
6. docs/handoffs/2026-10-14-claude-s12/lane-codex-dec197-spec-2026-10-16.md (this file, new)

## Root-selected technical contract recorded (not this lane's own decision)

1. Logical `delivery.route_manifest_version` maps explicitly to physical `platform_private.route_manifest_version`; `platform_private.publication_projection` sits beside the existing consumer table. Every affected logical/physical FK spelling updated; no view FK.
2. One globally numbered complete artifact; unchanged locations carry forward; no owner/location partition and no new capability.
3. Sealed artifacts only: `ready → active → superseded`; compilation failures stay operational attempt results; no borrowed candidate/projection-building states.
4. Fields: `id uuid PK`; `version_no bigint NOT NULL UNIQUE CHECK >0`; `publication_set_hash text NOT NULL` lowercase hex-64; closed `state`; `generated_at timestamptz NOT NULL`; nullable `activated_at timestamptz`. Ready requires null activation; active/superseded require activation at or after generation. Activation time is write-once; identity/ordinal/hash/generation immutable; deletion refused.
5. Private identity sequence reserves positive global ordinals, monotonic not gapless; allocation order never authorizes replacing a newer active artifact; at most one active row via partial unique index; no fake initial active manifest.
6. `publication_set_hash` = SHA-256 of RFC8785 canonical JSON `{"publicationVersions":[{"publicationVersionId":"...","publicationHash":"..."}]}` for the complete frozen set, sorted by canonical lowercase publication-version UUID, no duplicates; values are those rows' immutable `publication_hash` (char(64)).
7. PublicationProjection copies BE04c columns, seven states, checks, unique key and three indexes exactly; direct FKs to publication-version and manifest with NO ACTION/RESTRICT; ownership derived through publication-version; no generic IA owner/extra timestamp columns.
8. Consumer direct FK `projection_id → publication_projection.id` plus same-publication consistency: parent unique `(publication_id,id)` and consumer composite FK `(publication_id,projection_id)`; existing consumer publication-version FK preserved.
9. New tables ENABLE/FORCE RLS, no policies, no runtime grants, explicit PUBLIC/anon/authenticated/service_role revoke; no new API RPC/principal/exposed schema; invoker immutability/lifecycle triggers with execution revoked; no bypass definer; caller-settable GUC conveys no authority.
10. IA04 generic owner/created-timestamp contradiction resolved for projection/consumer by derived publication ownership and the exact BE registry; no owner columns or new permissions added.

## Clause application status

- C1 (IA04 main: manifest model row + typed contract; resolve owner/timestamp contradiction): APPLIED. Added a `RouteManifestVersion` Data Models row and a typed registry entry (six fields, no `owner_id`); corrected the generic `PublicationProjection` and `ProjectionConsumerState` typed entries to drop the contradictory `owner_id`/extra-timestamp fields, deriving ownership through the publication-version row and the exact BE registry.
- C2 (IA04 deep dive: consistent six fields + typed contract reference): APPLIED. The `route_manifest_version` row now states the six fields, sealed states, immutability, write-once activation, one active, physical/logical mapping and a typed-contract reference to BE04a.
- C3 (BE04a: typed manifest registry + state/hash/immutability/physical mapping; FK spellings): APPLIED. Added the `RouteManifestVersion` PostgreSQL registry row (ordinal, `publication_set_hash` definition, sealed-state CHECKs, partial unique active, indexes, forced RLS, no owner column); the state-machine paragraph now records the sealed artifact and compiler-attempt distinction; `RouteRecord`/`RedirectRecord` `manifest_version_id` FKs now carry the explicit physical mapping.
- C4 (BE04c: physical projection + same-publication paired FK): APPLIED. `PublicationProjection` now names the physical table and DEC-167 version-row mapping with NO ACTION/RESTRICT and the parent unique `(publication_id,id)`; `ProjectionConsumerState` records the direct projection FK plus the same-publication composite FK `(publication_id, projection_id)` and the preserved publication-version FK; `active_delivery_pointer` manifest FK mapped; state paragraph records the sealed store and the default-deny RLS posture.
- C5 (phase-2 bounded sequencing note only): APPLIED. One `**Receiving foundation (DEC-197)**` note under the Slice 11 header pulls the receiving foundation into S11 and leaves S13/S15 unchanged; it adds no criterion and changes no body, ID, count or check.
- C6 (report): this file.

## After-hash manifest (SHA-256 at freeze)

- IA04: 438bcdafc8321cae279fa4ae81dc4a25de37a2463c9426824f2daaa4f82ef282
- IA04 deep dive: d4d496d5150948b56d2b6767885bc668d764b317c7f868ac0b377118d7febd2c
- BE04a: 0028fec48dfafc3e76cc19d8fe17da4f138586ea39a44fb30f887f121574b9d1
- BE04c: 58d69eec458d9d5a0d26a7f56c8892a4652aa4c599fdf2a44437cf90862542e4
- phase-2: 3881bf3b55445cd31b11604f95a7a010ce503a371a3d4d15948248572e430730

## Verification performed (read-only)

- S12 remains 285 unchecked / 0 checked; the eight DEC-193 changed body bytes are unchanged; no P2-S12 AC row body/ID/count/check altered by this pass (the only phase-2 addition is the DEC-197 note).
- No other file touched; the applied consumer migration `20261010165000_cms_projection_consumer_state.sql` is byte-identical, SHA-256 e9bbd0f78fd8f6240fb4e3a543ad11e51081338abcf6cbba47679b5038bfc6ec.
- No new endpoints, writers, active pointer or consumer implementation; no future projection purge/revocation/tombstoning rights removed by this receiving foundation.

## Before-hash manifest (SHA-256 at cascade start)

- IA04: 398c9ec8ab3fc098679cb85ce984da174a8bb2b84f5b8b8c51870a2b54874cfa
- IA04 deep dive: 7f2634363a51bbb8dd15d7f77680a560224d6131d76fe5af167c2f207e0e770e
- BE04a: 3b792fe82d6d3b9636ff326c3dc1145f70923adb77d5e85b5d7f7243b9f54260
- BE04c: ccba69028672393c68175ea1aaf98a34ccd225ec1d982a1ba14761511d3f7323
- phase-2: 453a80659333bbf973b576cb12cafe77d953e208e947fb4d1770247e014b87cb

## Locked sources read

- Brief docs/handoffs/2026-10-14-claude-s12/briefs/codex-dec197-receiving-contracts.md (full).
- Canonical DEC-197 in .memory/wiki/decisions.md.
- IA04 main Data Models + Typed Field and Cardinality Registry; IA04 deep dive Canonical Field Contracts / Navigation and Routes; BE04a PostgreSQL model registry + compiler seam; BE04c PostgreSQL model registry + consumer table.
- DEC-167 mapping of `publication_id` to the publication-version row; existing publication-version `publication_hash char(64)`.
- Applied consumer migration `20261010165000_cms_projection_consumer_state.sql` SHA-256 e9bbd0f78fd8f6240fb4e3a543ad11e51081338abcf6cbba47679b5038bfc6ec (unchanged; not edited).

## Blocker

None. No model-availability error.

## Bounded correction pass (DEC-197 independent final BLOCK3, root-released; no new owner decision)

Only the two BE specs and this report were edited; IA04, the IA04 deep dive and phase-2 stayed frozen (hashes unchanged from freeze). The independent review cleared the remaining fields, hash, lifecycle, mappings, projection, FKs, no-hash-cycle and purge; those are preserved.

1. **BE04c scope error fixed (BE04c:353).** The consumer-state table was mislabeled as a new no-policy table. Default-deny now applies to the two NEW tables only, `platform_private.route_manifest_version` and `platform_private.publication_projection` (ENABLE/FORCE RLS, no policies, no runtime table/sequence grants, PUBLIC/anon/authenticated/service_role revoked). The EXISTING `platform_private.projection_consumer_state` explicitly retains its applied forced RLS, its `projection_consumer_state_rpc_policy` policy and its CMS definer SELECT grant, receiving only the new FK constraints; the applied `20261010165000_cms_projection_consumer_state.sql` migration is unaltered.
2. **Governing guard constraints moved into BE04a (BE04a:507, Grants and RLS).** The receiving security paragraph now states the default-deny posture for the two new tables, the retained consumer policies/grants, and that any lifecycle/immutability guard trigger function is `SECURITY INVOKER` with direct EXECUTE revoked — no `SECURITY DEFINER`, no definer bypass, no new principal, and a caller-settable CMS GUC conveys zero authority. This is now governing spec text, not only report text.
3. **Global-artifact forward-carry and authority fence (BE04a:482).** A whole-manifest activation appends a new sealed artifact that carries forward every location the expected active artifact still holds unchanged; the global storage and positive global ordinal allocation grant no authority to change another location's content, and a publisher stays scoped to their own assigned location.

### Corrected-path lines and hashes

- .memory/wiki/specs/be/04c-public-delivery-cache.md:353 — after-hash c031910979a773e08bd1a6c8ede20623692489f91c47331333ad2aa8b61b846d
- .memory/wiki/specs/be/04a-navigation-routes-discovery.md:507 — governing guard constraints
- .memory/wiki/specs/be/04a-navigation-routes-discovery.md:482 — global artifact forward-carry/fence; after-hash 8914f158ff26c5d01795d4c5e879f73a2744f867f520018a686509d1bedf2a62

Frozen and unchanged this pass: IA04 438bcdafc8321cae279fa4ae81dc4a25de37a2463c9426824f2daaa4f82ef282; IA04 deep dive d4d496d5150948b56d2b6767885bc668d764b317c7f868ac0b377118d7febd2c; phase-2 3881bf3b55445cd31b11604f95a7a010ce503a371a3d4d15948248572e430730.

Status: **FROZEN / UNRUN** — no acceptance claim; frozen for independent readback.

## Handoff

Root (6.1) owns planning, validation, review and integration, and integrates S11/S13/S15 tracker notes after freeze. No AC row body, ID, count or check changed; the S12 285/0 and the eight DEC-193 changed body bytes remain exact. Do not claim S13 AC164 complete. All six files are frozen and root independent review is active; no contract/TDD execution until review completes.
