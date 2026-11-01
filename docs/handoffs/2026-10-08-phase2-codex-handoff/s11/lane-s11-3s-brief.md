# Lane S11-3s — Slice 11 shared SQL helpers (read ORCH/lanes/COMMON.md first; LANE = slice11 checkout)
Inputs (read before writing): ORCH/codex/s11-rpc-plan.md (§1 shared conventions + existing helper table, §2 refusal catalog, §5 invalidation/
preflight/lineage/outbox functions, §6 data-model delta, §7 D19 registry, §8 split) — it is a Codex draft: VERIFY every claim against the
code/spec before relying on it; ORCH/lanes/NOTES.md rulings DEC-156/157/158 (binding); BE03b .memory/wiki/specs/be/03b-editorial-workflow-
publication.md (E1-E3 derived state/manifest/version set, E7 settings, E8 time authority, D19 preflight registry, review invalidation, publication
lineage E3, persistence rows, global lock order :1698-1720); Slice 11 criteria AC085-AC122 in .memory/pipeline/progress/slices/phase-02-slice-11.md;
the S11-1 contract module packages/contracts/src/cms-editorial/{preflight,version-set,workflow-models}.ts (CMS_PREFLIGHT_REGISTRY is the TS
source of truth for the registry; your SQL must match it row for row).
Ownership: NEW migrations supabase/migrations/20261005017500..20261005017599_* and NEW supabase/tests/phase_02_slice_11_helpers_*.sql (+ a
fragment dir if needed). No browser RPC wrappers (lanes 3a/3b/3c own those, 017600+). No TS, no edits to lane S11-2 files (017000-017499,
phase_02_slice_11_* schema tests): lane S11-2 is still landing tables (assignments, decisions, dependencies, settings snapshots, preflight registry,
schedules, publication lineage, preview tokens). Read ORCH/s11/lane-s11-2-report.md before each item; build only on tables lane 2 has
checkpointed; order your items so table-independent helpers come first; if a helper needs a column lane 2 has not landed, write the failing
pgTAP first, append a "NEEDS FROM S11-2" line to ORCH/lanes/NOTES.md, and move on to the next item.
Deliver (private SECURITY DEFINER helpers, owner wejammin_cms_definer, search_path '', no execute for anon/authenticated/service_role unless a
wrapper needs it; frozen names/signatures — write them first into ORCH/s11/helpers-api.md so lanes 3a/3b/3c can code against them):
 1. effective revision state (E2) derivation function(s) (draft/in_review/approved/scheduled/published/archived or whatever BE03b E2 names exactly).
 2. frozen dependency manifest builder + JCS hash + version-set projection (E1/E4: <=256 entries, 32 KiB, exact kinds), equal to the TS
    versionSetOf/versionSetMatchesManifest on the same fixtures (add a parity fixture both sides can read if practical).
 3. canonical reference counter cms_revision_references(revision, kind) used by reference_gate (D19).
 4. settings snapshot creation/lookup (E7) and the tz mirror cms_tzdb_version() returning the pinned tag recorded by lane S11-1
    (read ORCH/s11/lane-s11-1-report.md / DEC-153 addendum for the tag; if not yet recorded, leave this item last).
 5. acting-context version/hash helper if BE03b requires one for preview binding/verifier.
 6. preflight evaluation: phase submit (1-16) / execute|schedule|publish (17) over the registry rows; reference_gate semantics; database
    providers for categories implemented in Slice 11 (contract, schema, template, block, settings, relation, security, migration,
    domain_binding, revocation); category 11 accessibility consumes verified evidence per DEC-150/DEC-158(c); report shape = the TS
    PreflightReport (registry order, reason sets). Unavailable => retryable 503 mapping, failed => 422 preflight_failed.
 7. core review invalidation (closed reasons; review open|approved -> invalidated, CAS; cancels pending|failed_retryable schedules with
    approval_invalidated or entry_unavailable; revokes preview tokens as BE03b says) and its callers' contract (who calls it: dependency
    change, authority loss, new draft on the entry, etc. — wire the triggers that BE03b assigns to existing Slice 10 writers ONLY through
    new trigger definitions in your range, never by editing old migrations).
 8. publication lineage append (E3: publish appends the active head and supersedes; unpublish/expire/archive append a revoked tombstone;
    absent active head => publication_not_active) + identifier-only outbox emission of cms.publication.changed.v1 and
    cms.entry.review-changed.v1 via the existing cms_emit_event/audit helpers.
Lock order: DEC-157. Every helper gets pgTAP (RED observed first) incl. negative/concealment/immutability cases; race-relevant helpers get a
note for the lane-3 race runner. DB: ORCH/bin/lane-db.sh LANE [your files] (main stack; shared lock) — lane S11-2 uses the second stack.
Before finishing: full `ORCH/bin/lane-db.sh LANE` (all pgTAP) green or name the other lane's in-flight breakage; supabase db lint via the lane
runner if available. Report ORCH/s11/lane-s11-3s-report.md with checkpoints after each item (item, files, RED->GREEN, frozen signatures).
Final chat <=6 lines.
