# DEC-193 revision carry receiving tests

Author status: **UNRUN**. Root owns staging, actual RED observation and runtime.
Discovery entrypoint: `../phase_02_slice_12_dec193_carry.sql`. Everything rolls
back. Do not run against a default/hosted target or auto-start/reset services.

## Authority

- BE03c `03c-composition-taxonomy-localization.md:1543`: restore translates the
  named source's active compositions; current registry, withdrawn-block refusal,
  inactive-pattern exception for detached mode, compatible-template slot gate.
- Same document `:1545`: append/resolve/restore append carry rows with
  `carried_from_id`, identical `position` and `detached_tree`; autosave cannot drop
  composition. `:1487,1563`: newest per path before state, retired render exclusion,
  append-only histories and canonical detached content.
- BE03b `03b-editorial-workflow-publication.md:186,193,196`: real entry CAS,
  immutable revision version, replay-before-CAS and exact replay signal.

The suite calls the actual `platform_api.cms_create_revision`,
`cms_resolve_conflict`, `cms_restore_revision` as `service_role`, under ordinary
signed test actor sessions. It is database receiving proof, **not HTTP/JWT
gateway, transaction-isolation, concurrency, hosted or provider proof**.

## Fixtures versus production proof

Real producers: signed registry registration/lifecycle; compiled/approved active
content type; current editorial policy; governed pattern creation/activation;
public pattern placement/detach/accept; actual conflicting public append and
public conflict resolution. No policy replacement, fabricated signature,
disabled trigger/RLS, production helper replacement or manual ConflictRecord.
Register the signed child before the root: root `allowedChildren` resolves the
existing child registry key. Both original inputs and receipt assertions remain.
The private policy prerequisite runs through a test-only scoped context helper
that restores `app.cms_rpc` on normal return or error. The real projection,
configuration/type and all public request/session contexts are unchanged.
Removal and keep setup are separate real target2 accepts: `/gone` explicitly
chooses `theirs` (also for placed `/main/gone`); `/keep` sends no choices. Each
request derives the current entry CAS independently; both outcomes must succeed.

Explicit fixture-only seams:

- Initial entries, draft revision, required title and assignment use guarded
  inserts, matching S10/S12 existing bootstrap conventions. Payload/value hashes
  are valid at initial insert; immutable revisions are never updated.
- Public detach produces the full local tree. One guarded append-only newer
  composition fixture adds nonempty bindings (placement has no bindings input).
- A guarded second draft changes only title, allowing real field conflict and
  source/current restoration discrimination without depending on carry already
  being implemented. This is not a public append-success proof.
- Missing-slot source is an appended historical revision bound to a second real
  compatible template. Its rows originate from real `/main` placement; both
  source/current bind the real `/side`-only template. This tests rejection of
  unresolved historic slots, not schema-migration or latest-template selection.

## Matrix and mutation sensitivity

`CC-APP001..005`: fresh ordinary autosave; exact newest active heads only;
newer detached local/binding row beats older active linked history; newer retired
`/gone` beats older active `/gone`; literal tree/binding and positions `[0,2]`.

`CC-RES001..005`: real proposed conflict from same-field append; explicit yours
resolution; carry from the entry's current draft (theirs), never the conflict base
(DEC-209, BE03c receiving obligation 4): the current draft holds its own real
placement, distinct from the base revision's detached/keep history, and nothing of
the base leaks into the resolved draft; immutable source history; resolved record
and new draft commit together. The other resolve worlds (`CB-RES-*`, `CP-RES`) keep
their composition on the current draft through `s12cc_theirs_first`.

`CC-RST001..004`: named-source local content, not current target content; parents
`[current,source]`; source title and exact detached tree; carry/provenance.

`CC-RST005..011`: inactive linked pattern refusal; inactive detached SQL-NULL
tree success; inactive nonnull-tree provenance success; absent compatible slot;
signed child deprecation with independent current tuple digest (local subtree
versus whole linked pin); signed child withdrawal; withdrawn legacy pinned root.
Restore's detached-mode exception is not restricted to nonnull trees. A legacy
NULL tree is never fabricated into a snapshot and still checks block authority.

Success helpers check fresh IDs/version1, full semantic rows, `carried_from_id`,
all old composition rows, entry CAS/current pointer, one revision/reservation,
and old revision/value/relation immutability. Append/resolve retain one audit/
outbox pair. Restore requires exactly its revision-created and chain-evidence
audit/outbox pairs, exact identities and safe payloads, and unchanged old effects.
Exact-key replays
preserve body and all effects; changed key payload and stale CAS refuse atomically.
These controls cover APP001/RES001 and every successful restore variant
RST001/RST006/RST009, using each original captured request. Restore-only resource
reads unwrap the locked `{resource, restoreVerification}` envelope; exact replay
compares the complete raw envelope. Each restore checks exact envelope keys,
request/registry facts against the source and active schema, the real zero-edge
manifest, and all eight distinct seams (not merely verification presence).
The zero-edge manifest uses an independently assembled fixed-key JCS hash;
the request's deterministic chain UUID is checked separately from its generated
table-row primary key. Signed withdrawals send immutable definition version1,
not a lifecycle-step counter, and verify the actual latest lifecycle event.
Refusals compare full rows including compositions, entries/revisions/values/
relations, conflicts, presence, restore manifests, idempotency, audit and outbox.

Current `carried_from_id` absence is read via JSON, not a static nonexistent-column
reference. Missing exact public signatures are captured and reported, never skipped.
The suite contains no term/taxonomy, render/preflight/manifest,
arbitrary-protected-props or race acceptance claim. Pending ordinary carry and its
subsequent public diff are covered by the separately claimed017 extension.

## DEC-200 historical-parent extension

`018-parent-path-carry.sqlinc` is TEST-only ordinary append/resolve coverage.
The owner-approved rule resolves a recorded parent within the source owner and
revision to its path, then remaps to that path's newest eligible copied head.
Neither restore's active-only policy nor any public schema/permission is widened.

An isolated governed pattern and genuine public placement supply the linked parent
donor. Labelled guarded legacy graphs add parent edges (public placement does not
produce those edges); real public detach appends P2 after the child recorded P1.
Both actual ordinary commands must copy selected P2 and reconnect the child to its
fresh ID, retain immediate provenance/every other semantic member/positions, keep
complete source/preexisting row history immutable, and preserve effects/replay.
Resolve uses a real conflicting append and checks the exact durable resolved ID.

Excluded-parent cases use real removed-root `theirs` retirement, not an invented
tombstone. Cycle cases store the valid acyclic history C0<-P1<-C1 and C0<-publicP2;
logical-path selection alone produces C1<->P2. APP and RES must refuse atomically
as existing `P0001 VALIDATION_FAILED`, exact DETAIL `["/baseRevision"]` (BE03b1930,
root-confirmed implementation pointer), preserving full stores, open reviews and
unresolved conflicts. No older parent is resurrected, child dropped/detached or
cross-revision edge retained. Own helpers return every TAP assertion, including
real conflict setup; missing carry/provenance becomes assertion RED, never a
guessed future helper call. All original000/010/015/016/017/020 remain unchanged.

Author UNRUN; root owns complete RED, premise/error-boundary review and subsequent
GREEN release. Detailed freeze hashes/source anchors are in
`docs/handoffs/2026-10-14-claude-s12/lane-codex-dec200-parent-carry-2026-10-16.md`.

## DEC-201 restore boundary extension

`021`–`024` follow frozen020. They exercise only the existing public restore
request/envelope/error contract; no future427/428 helper is called. DEC-201
explicitly selects newest-before-active named-source rows and remaps historical
parents by the selected active logical path. Pending/draft/retired heads never
carry or reveal older active history. Ordinary DEC-198/200 policy is unchanged.

`021` supplies isolated signed root/leaf/unrelated/replay block donors, scoped
signed calls and labelled guarded entry/history envelopes. Signed calls restore
all affected JWT, CMS/MFA/configuration/release/response/SQL-role settings on
success or exception, with explicit restoration assertions. The literal512-node
tree contains scalar/JSON-null values and exceeds256KiB without exceeding any
per-value bound. These are READ/legacy/scan-output fixtures, not missing public
placement/scan/schema activation producer claims; guards remain enabled.

`022` distinguishes active-only newest selection; a real active outer pattern
with genuinely superseded nested pin (linked refusal versus plain detached
SQL-NULL exception); canonical own nodes ignoring a withdrawn unrelated pin
sibling; exact source/main versus different current/side template bindings; full
large-tree/standalone-NULL copying, creator/position preservation, fresh selected
parent edges and immediate second-generation provenance. Explicit source UUIDs
and independently assembled literal registry tuple preimages are the oracles.

`023` reuses018's valid guarded physical DAG and real public detach/retire
successors for restore-specific DEC-201 cases. Historical P1 reconnects to the
fresh selected-P2 copy. A real retired newest parent and an acyclic physical
history whose selected logical paths form a cycle both require whole
`migration_chain_incomplete` refusal. Complete source/storage images, exact open
review/conflict IDs and no child drop/resurrection/detach are checked.

`024` installs only an owned test trigger reusing015's frozen later-copy detector:
the first actual destination row is witnessed before a distinct second copy
fails. Full stores, including review/conflict/reservation/chain-manifest/effects,
must roll back with the original diagnostic. Exact-key retry succeeds fresh and
commits precisely the two restore pairs plus one existing review-invalidation
pair. After a real signed dependency withdrawal, exact original envelope replay
must still succeed unchanged while a fresh key refuses atomically.

Author UNRUN. Original000/010/015/016/017/018/020 and all production are frozen.
Actual relation-target lock barriers, race/hosted/HTTP/provider and broader
acceptance remain separate: this serial suite uses no sleeps or fake concurrency.
Root owns static review, genuine complete RED and any subsequent GREEN release.
