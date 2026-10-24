# DEC-198 / DEC-200 ordinary composition carry — source-only GREEN author

Native author: `gpt-6.1-sol / ultra`, `native_registry_green_20261016`.
Worktree: `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`.
Status: authored **UNRUN**; root owns staging, SQL execution and independent review.

## Authority and observed RED

The exact four-path claim is recorded at
`.memory/pipeline/progress/slices/phase-02-slice-12.md:7`.
Root supplied a complete carry cohort: 486 assertions, 392 PASS, 94 FAIL,
no SQL abort; receipt digest prefix `2b00c3f7`. Independent DEC-200 test review
was CLEAR. These are root-observed receipts, not author executions. The cohort
also contains held restore obligations; this ordinary-carry change does not
claim to clear every failure or any acceptance criterion.

TDD and migration-management skills kept the existing RED/oracles frozen and
the correction forward-only. No tests, promoted migrations, old WIPs, README,
tracker, public DTO, API wrapper or restore implementation was edited.

## Locked source facts

- `.memory/wiki/decisions.md:5348–5357` (DEC-198) and
  `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md:1545`:
  select the base revision's newest row per path before active/pending
  eligibility; pending stays unanswered, with the same B pin and target.
- `.memory/wiki/decisions.md:5324–5334` (DEC-200): resolve the recorded parent
  inside the source owner/revision to its path, then reconnect to the fresh
  copy of that path's selected newest eligible head. Excluded parents and
  collapsed logical cycles refuse the entire command; never resurrect,
  drop/detach a child or retain a cross-revision parent edge.
- BE03c1545/1563: preserve every other semantic member, authored position,
  full detached tree, overrides, bindings and immediate carry provenance.
  Restore's active-only translation policy is separate and remains untouched.
- `20260927340000_cms_composition_owner_integrity.sql:11–23` supplies existing
  `(id,owner_id)` uniqueness and owner-bound keys.
  `20260927420000_cms_composition_parent_revision_integrity.sql:7–19` requires
  destination parents in the same revision/owner. The immediate parent FK and
  immutable rows require parent-first insertion (`202609275000...:6–12`).
- `20261014110300_cms_insert_pattern_instance.sql:258–261,285–294` already
  supplies the CMS definer's table and UUID-function privileges. The new helper
  is invoker-security, CMS-owned, empty-search-path and closed to API roles;
  it does not establish RPC context or expand those existing privileges.
- `20261005017580_cms_review_invalidation.sql:365–393` already invalidates older
  live reviews inside the new revision's INSERT trigger. Carry adds no duplicate
  invalidation, audit or outbox producer.

## Implemented decomposition

`20261016042000_cms_composition_carry_provenance.sql` adds nullable UUID
`carried_from_id`, with no default or backfill. Its composite self-FK binds
the referenced source ID to the same owner while allowing provenance across
revisions. Legacy NULL remains NULL; no public resource field is added.

`20261016042100_cms_revision_composition_carry.sql` adds only
`platform_private.cms_revision_composition_carry(uuid,uuid,timestamptz)`:

1. Validate distinct actual source/destination revisions with identical owner,
   entry and locale, a supplied snapshot timestamp and an empty destination.
2. Select newest immutable rows per path, then keep active/pending heads. Copy
   typed composites into a plan; allocate all fresh UUIDs before graph writes.
3. Resolve each recorded parent within the source owner/revision. Its path must
   have an eligible selected head; map that head to its preplanned fresh ID.
4. Topologically plan the complete collapsed path graph. Missing/excluded parents
   or a cycle raise whole `P0001 VALIDATION_FAILED`, DETAIL `["/baseRevision"]`,
   before the first composition INSERT.
5. Insert parent-first. Overwrite only ID, destination revision, version `1`,
   created/updated timestamps, immediate `carried_from_id` and remapped parent.
   Typed row copying preserves SQL NULL versus JSON null and every other stored
   semantic column, including `created_by`, pending target and full large trees.

There is no registry lookup, activity decision, digest repin, JSON serialization,
source UPDATE, per-row effect or new aggregate node/JSON/byte/read cap. Later
INSERT faults are not caught or translated by this helper; they propagate into
the existing command transaction, including prior review/reservation effects.

`20261016042200_cms_revision_composition_carry_rpcs.sql` amends only the two
private ordinary revision functions. Each exact new-revision INSERT tail is
anchored together with the following first field INSERT; the helper is inserted
between them with `(base_row.id,new_revision_id,snapshot_time)`.
Replay, early conflict disposition, authorization, CAS, field/relation assembly,
head movement, conflict resolution, effects and completed responses stay outside
the amendment. Normal CREATE OR REPLACE preserves the existing function identity
and cached callers; guards compare the complete inverse, OID, all `pg_proc`
attributes except `prosrc`, and the original comment. Public wrappers are intact.

## Final-source / exact inverse readback

The complete promoted `20261005018045...` (652 lines) and
`20261005018050...` (718 lines) were read. A source scan of later definitions and
live-source amendments found the later private-body change in
`20261010130000_cms_settings_write_tail_lookup.sql:103–205`: its E7 positive-201
settings tail. The locale head-move migration changes triggers, not these bodies.
The 422 amendment reads the actual installed body and never restores an older
full function copy.

Text-only reconstruction of the final checked-in bodies, including the E7 tail,
produced one old anchor and one new anchor per function; reversing the insertion
restored each complete prior source exactly. The E7 tail bytes stayed present.
This was source-string analysis, not a parser, SQL execution or live catalog read.

| Private function | Final prior body SHA-256 | Candidate body SHA-256 |
| --- | --- | --- |
| `cms_create_revision(jsonb)` | `d623e235390c90d3bd7b58033912cc48d392ad89ca3c1ed3ecb0e319316e075b` | `f1f542a25accaa2cc25f3cb21c114da33edded0824707c773110ee0f8c6ae9b2` |
| `cms_resolve_conflict(jsonb)` | `6df742cd86390e10baa759e3a7853d7b1900f54cfae2c7d53193c53d02f88df4` | `be3296cd0b52135e1285259bb466e8687df48f41a0d976ad01fa0fe76f2b2263` |

The pre-E7 source MD5s also match E7's locked predecessor fingerprints:
create `f0bfdac1be9fee6f14873698bae2c953`, resolve
`26ede79aefc8a7fcb2ee5330dc617af1`.

## Frozen SQL manifest and remaining gates

| New migration | Physical lines | Bytes | SHA-256 |
| --- | ---: | ---: | --- |
| `20261016042000_cms_composition_carry_provenance.sql` | 16 | 772 | `925719e983f5d9ccc0b01d2bbeb4a3cfadd73071586c7b7bef77cf7199c9e435` |
| `20261016042100_cms_revision_composition_carry.sql` | 174 | 7795 | `c473b33d72491c9faa20cc7e0d551da77a7a8b4a57b687959b7aa32e4c93ab03` |
| `20261016042200_cms_revision_composition_carry_rpcs.sql` | 87 | 4493 | `a714f7d22f2618ee657db5ca3a9f6cc4b7f7cdfe6659aad0110fcdf399a169b2` |

Author runtime/parser/formatter/tests/DB/Docker/network/Git: **UNRUN / not used**.
Only the released new files were written, through absolute `apply_patch`.
Root must perform normal source/size preview, actual guarded migration application,
the complete carry cohort (including 018 parent-path controls), relevant receiving
regressions and independent review. Schema/ACL/OID preservation, SQL syntax,
runtime atomicity, race behavior and production/hosted acceptance are not proved
by this source-only handoff. Restore427/428 and all other lanes remain separate.
