# DEC-193 effective composition consumers — author freeze

Native `gpt-6.1-sol` / `ultra`. **Author UNRUN.** Exact claimed writes are four
NEW WIPs42300–42600 and this NEW report. No promoted migration, existing WIP,
test/oracle, README, public schema, loader, carry420–422, restore or provider edit.
The primary checkout remains readonly.

## Authority and RED boundary

BE03c1487/1563 makes a nonnull detached tree the complete content authority;
provenance never renders it. A NULL-tree pattern row keeps exact pinned expansion
and overrides, including pending B and superseded nested pins. The standalone
NULL-tree case remains one block. DEC-185 retains authored position; newest row
selection precedes live eligibility. Existing manifest/render `draft` eligibility
is preserved alongside `active` and `pending_diff`; newest retired/superseded heads
do not resurrect history. DEC-198 leaves an unanswered pending row on its pin.

Root supplied the prior complete consumer RED:352 assertions /303PASS /49FAIL,
meaningful consumer behavior failures. The corrected expanded cohort is a separate
root-run gate; no result, exact new count or GREEN status is inferred here. TDD,
migration and surgical-development skills informed the narrow read adapters,
guarded live-source amendments and explicit preservation proofs below.

## Implementation

- **42300** introduces two closed private STABLE/INVOKER helpers, empty search path,
  owned by the CMS definer. `cms_revision_effective_composition(uuid)` chooses the
  newest immutable row per path before eligibility. `cms_composition_effective_nodes`
  returns zero-based canonical index, exact block key/version and arbitrary JSON
  effective props. A nonnull tree uses405's pure canonical expansion only. A
  NULL-tree pattern uses418's exact slot/root binding, non-strict B expansion and
 406's pure B=B resolution to apply local overrides. A standalone row returns its
  own props unchanged. No activity/registry gate, provenance expansion for a
  nonnull tree, digest repin, write, public diff cap or aggregate tree cap is added.
- **42400** amends only17560's composition block selection and pattern join. All
  reachable node identities feed the existing DISTINCT/template UNION, registry
  completeness check and 128-block/256-total/32KiB manifest bounds. Patterns are
  the selected heads' exact `(owner,lineage,version)` provenance rows, deduplicated;
  neither older history nor newest active targets are substituted. The old source
  anchor includes the final promoted141300 multiline pinned-row join, not the
  obsolete17560 `pattern.id` join. Template union
  and schema/terms/locale/settings/relations/checker assembly remain source-exact.
- **42500** preserves17910's six returned columns and field derivation. Internal
  ordering adds authored position before path/id and then canonical node index,
  retaining fields first and existing slot ordinal/fallback. Every block node is
  anchored to its selected head ID. Root pointer is `/composition/{headId}`;
  descendants append `/nodes/{zeroBasedCanonicalIndex}`. Expanded reference chains
  never enter the bounded private pointer. No field-to-slot binding is invented.
- **42600** materializes effective nodes once per selected head, then joins each
  plan identity to that head/index. Each node uses its own registry identity,
  lifecycle, digest, name-required contract, declared name field and effective
  props. A withdrawn child remains a node for the Worker's structural finding;
  no whole-tree registry validator drops it. Existing unregistered/fallback
  behavior, field payloads and complete renderPlanHash formula17910:198–199 remain.
  The public loader's authorization, no-write behavior, uniform NOT_FOUND and1MiB
  document bound are untouched.

412 is a D5 image, not a render adapter, and is not called. Volatile416's writer
security validator is not called from these STABLE reads. No public API execution,
table grant or new schema member is exposed. New helper ACLs revoke PUBLIC/anon/
authenticated/service_role; existing private function ACLs are not amended.

## Source-preservation evidence (text only)

The only amended installed functions are:

| WIP | Installed function | Exact old anchors |
| --- | --- | --- |
|42400|`cms_build_dependency_manifest(uuid)`|2, each once|
|42500|`cms_revision_render_plan(uuid)`|4, each once|
|42600|`cms_accessibility_checker_input(uuid,text)`|3, each once|

Initial text comparison used17560 alone for424 and missed final promoted141300's
join amendment. That initial manifest proof did NOT represent the installed prior
state. Root's first staged gate correctly stopped at424 with55000 unexpected
anchor2, exit2; no TAP tests ran.423 had executed;424 rolled back and remained
unapplied. No functional GREEN is inferred from that failed reset gate.

Root then captured the exact live source/attributes under four locks:
`/tmp/wejammin-native-receiving-proto-red-BkaHbW/dec193-manifest-after-failed-424.json`,
SHA256 `e1edf3cd94ea21ca41c877cd750992572ee131cd91bf03d44ea6a07ab4d623ee`.
Author read this code/metadata-only receipt:493 applied, last42300; manifest prosrc
10144 UTF-8 bytes, SHA256
`4b74b666e01e0510af1d418ad439b4727a8e27a2e4f7e2bd037e17f96b9ea8d6`.
It exactly matches17560 plus the checked-in141300:37–43 amendment.

The released correction changes ONLY424 old anchor2 to that exact final multiline
join; new anchors/query and every guard remain unchanged. Built-in text comparison
against the receipt's exact `source` found both old anchors once and reversing
both substitutions reproduced the complete live prior source byte-for-byte.
Intended candidate prosrc remains10058 bytes, SHA256
`10cd42552119846fa78aa7f9f889403af81e387c7e60da83c6375f799f8f51cb`.
425/426 text comparisons remain against their checked-in17910 bodies, with4/3
unique anchors and exact complete inverses. This is not SQL parsing/execution or
proof of post-application live attributes. Each migration repeats
the unique-anchor and whole-source inverse checks against live `pg_proc`, obtains
the canonical definition and uses ordinary CREATE OR REPLACE. It then requires
the same OID, exact expected source, every other pg_proc attribute (including
owner/ACL/signature/security/volatility/search path) and original comment. An
unexpected source or attribute aborts, rather than silently replacing it.

Read source SHA256:

- promoted17560: `528ebd03ae6a163e8886ef9263b78c66c97d6d5f3f431c7651b784f9a660db01`.
- final promoted141300: `0e9aac7acd3bb9a9c86e4a8a53560847c419b642933fb4477789585469247445`.
- promoted17910: `1ae77c6ef1541233cf725484c56f01ef92b644591088c2d1d3a9bddd8e5ca364`.

## Freeze manifest

All paths below are under `supabase/migrations-wip/dec193/` in
`/home/rob/.codex/worktrees/phase2-slice12/WeJammin`.

| File | Lines | Bytes | SHA256 |
| --- | ---: | ---: | --- |
|`20261016042300_cms_revision_effective_composition.sql`|100|5020|`10d004b6f3830c33cd646bc27c9b0639dee770b7ac0b72673b1a13c1f10e0b99`|
|`20261016042400_cms_composition_dependency_manifest_dec193.sql`|82|4356|`ecad7d21253acae05eea42e677fb04cacf9b65fbdbfe63f0a1776e42218ffde9`|
|`20261016042500_cms_revision_render_plan_dec193.sql`|106|5920|`db3d3f797232069310987d519084d3e465ca5267429f49d4413df5381531c188`|
|`20261016042600_cms_accessibility_composition_dec193.sql`|85|4757|`6e6cfa4a58b3f027fe7155ea6adde7ad56f8bb540344a1f0136923018076974d`|

## Required root validation and limits

Author ran no formatter/parser/import, test, DB/Docker/process, network or Git.
Only source reads/text comparisons/hashes and absolute apply_patch were used.
Root must inspect normal form/line budgets, stage in dependency order after405/
406/418, run actual consumer SQL and Worker shared-literal parity, regress the
existing receiving/security cohorts and independently review before integration.
Runtime counts, query cost, live OID/ACL preservation and GREEN remain **UNRUN**.

The historical352 receipt is not expanded-suite acceptance. Any remaining real
placement/selected-roots premise failure is a separate writer boundary, not
authority to weaken frozen consumer tests. This lane does not clear D5 pending
eligibility, revision-aware digest-provider/frozen-currentness, carry/restore,
hosted transport, maximum-document-size or full-size performance acceptance.
