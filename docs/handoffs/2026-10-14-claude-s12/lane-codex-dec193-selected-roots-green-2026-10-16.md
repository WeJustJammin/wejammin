# DEC-193 selected-roots producer integration — author freeze

Author: native `gpt-6.1-sol` / `ultra`, `native_dec193_contract_green_20261016`.
Status: **UNRUN**. GREEN names the implementation release, not a passing gate.
Worktree: `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`.

Root's durable S12 Dispatch claim releases exactly four NEW434–437 WIPs and this
NEW report. All tests, promoted SQL, prior WIPs, shared README/tracking, public
contracts, Worker/Web, carry/readers/providers and other reports remain frozen.

## Authority and prior RED

Locked BE03c380/520–551/1483/1485/1563/1750/1836–1837 require optional1–512
unique expanded block-root selectors, complete ASCII grammar with72 segments/
4680 characters, selected-only placement in forest order, selected override
scope, unchanged stored row248/slot512/override512 bounds, and newest-retired
path reuse at the next version and unchanged position. New paths consume fresh
positions in forest order above the slot maximum across all state/version history.
Response items remain position-ordered. Omitted roots means every block root.

Root supplied actual complete RED:597 assertions,450 PASS,147 FAIL, no abort.
Receipt `/tmp/wejammin-native-receiving-proto-red-BkaHbW/dec193-selected-roots-currentness-first-corrected-red.log`,
SHA256 `65893f4cd697f6cc8459f82865194484247dfb4587bd4fc24d3296d7e63ee0ac`.
The existing guard still refused roots as an unknown key; omitted-root retired
reuse was independently RED. Root independently cleared the frozen new TEST
cohort after its released early-return diagnostic correction. Those are parent
receipts, not author executions or evidence of subsequent GREEN.

## Implementation

`43400_cms_pattern_placement_roots_check.sql` amends the installed private guard
through three exact anchors: permit the optional envelope member, declare one
loop record, and insert roots validation. Supplied JSON null/nonarray/empty/
oversized/duplicate arrays fail at `/roots`; malformed elements fail at their
zero-based `/roots/{n}`. Anchored C-collated ASCII key grammar permits1–72
complete segments and at most4680 characters. All old transport, UUID, positive
version, If-Match, digest, slot and override predicates remain byte-identical.
SQL NULL is omission only when extracting a missing request member; supplied
JSON null does not silently become omission.

`43500_cms_pattern_placement_selected_plan.sql` adds private
`cms_pattern_placement_selected_plan(uuid,cms_pattern_versions,text,jsonb,jsonb)`.
It expands the full pinned forest using the existing active/nested/cycle helper,
enforces the full512 expanded-block-node cap, proves each selector names an
actual block root, then retains all nodes under exactly those root identities
in expansion order. Request order never orders the result. Only selected root
rows receive the joined248-octet check; every override must name a selected
block node. A reference node itself is never admitted. No prefix matching,
address shortening, selected-only digest, aggregate128-path/diff limit, JSON
coercion or alternate legacy parser is introduced.

`43600_cms_pattern_placement_path_allocation.sql` adds private
`cms_pattern_placement_path_allocation(uuid,text,text,jsonb)`. Under the existing
entry lock it reads the slot maximum across all history and selects each chosen
path's newest version before state. A non-retired head is existing `CONFLICT`
at `/slotPath`; a retired head gets next bigint version and its kept position.
Only a new path consumes the next fresh position. Reuse-only placement remains
valid at INT_MAX because it requires no fresh position. Nonrepresentable fresh
position or next stored version refuses with the same existing conflict token
before writes, rather than overflowing or renumbering. Private allocation
metadata enriches root entries only and is not a new stored column/public field.

`43700_cms_insert_pattern_selected_roots.sql` amends the installed producer with
exactly five anchors: selected-plan call; old any-history occupancy block to
read-only allocation; old all-root fresh-position block to a comment; inserted
version; inserted position. Existing count/base declarations remain untouched.
No full producer body is copied. All original entry/authority/pin/type/review
lock statements, whole-pin registry digest and client expectation, concealment,
capability, replay, CAS, current-draft/exact-slot checks, per-root override
partition, NULL snapshot behavior, atomic insert/review/audit/completion and
position-ordered resource projection remain outside those changed anchors.
The public wrapper/closed items body/ETag handling is untouched.

The two new helpers are STABLE, empty-search-path, CMS-owned, private SECURITY
INVOKER functions. The existing CMS-definer producer supplies the needed SELECT
and private-helper EXECUTE rights:404 already directly reads composition history
at171–177/187–189 and calls the CMS-owned expansion path at167. No public/API
caller needs helper definer rights. PUBLIC/anon/authenticated/service_role EXECUTE is revoked.
Owner installation uses the existing temporary schema-CREATE pattern only if
needed and restores its prior availability; no existing function/public-wrapper
ACL or persistent schema permission is widened. No new lock is acquired.

## Guarded source preservation and static readback

Both live amendments require the exact installed identity, expected function
attributes, each old anchor exactly once and each new anchor absent. They check
each inverse anchor exactly once and reconstruct the entire original prosrc.
Only the single exact prosrc occurrence inside pg_get_functiondef is replaced.
After installation they require the same OID, exact new source, every other
pg_proc attribute/owner/ACL unchanged, and the original comment unchanged. Any
mismatch raises55000 and rolls back that migration transaction.437 additionally
refuses an unexpectedly public/client-executable private producer before editing.

Source-only literal replacement previews against the promoted guard and current
404 producer confirmed old-anchor counts1 and new-anchor counts0 for all three/
five anchors; both complete inverses are byte-identical. These are text/byte
comparisons, not PostgreSQL parse/execute or installed-catalog evidence:

| Body | Original prosrc SHA256 | Preview prosrc SHA256 |
|---|---|---|
| guard | `11135b02e5718cd855472fa4bd1f83af58f7e87aa828439dad2ddd5d55dbe56a` | `6af9aa4c9addbc534b905efcf91b447e7ee3f2903c0cfedd236a3b99637737a2` |
| producer | `35387335e442cc0f6c365cc1b9149e507aa5a86ddc832523f9465f9551f2069c` | `9d13737bfaf86bb44b198db3835c5d7ac0f9a71e31673b6d000bbed55d4ca74a` |

Full source readback of all four WIPs and this report completed. TDD and surgical
development guidance kept implementation behind the root-observed RED and
limited it to the approved private seams. Author used source reads, absolute
apply_patch, string/byte comparisons and hash inventory only. No SQL parser,
formatter, import/runtime, tests, DB, Docker/process, network, Git, promotion or
acceptance run occurred. Root owns independent review, installation/catalog
readback, focused/broad GREEN and real concurrency/operational gates. All four
WIPs are frozen together before any runner stages the entire directory.

## Frozen manifest

### P2 version-cap TEST-first correction — root RED, author code UNRUN

Independent review/root read found the existing composition storage CHECK at
`supabase/migrations/20260927290000_cms_composition_authority.sql:78` caps version
at2147483647 despite its bigint column type. The original436 bigint-maximum
guard would allow2147483648 and reach23514 after the roots prerequisite was
implemented. After the new TEST addition and root's actual RED, the separately
released one-predicate correction is `v_head.version >= 2147483647`, retaining
exact existing `CONFLICT`/`["/slotPath"]` and every other436 source byte.
Source-only reversal of that predicate reproduces prior frozen436 SHA256
`1300ff72f85fbf2ec8985394facd0a64352458d258d331eed6bcc821bbd878db`.

The released TEST-only addition in
`supabase/tests/phase_02_slice_12_dec193_selected_roots/030-retired-reuse.sqlinc`
uses valid labelled guarded legacy retired heads:2147483646 must publicly append
2147483647 at unchanged position7;2147483647 must refuse exact
`P0001:CONFLICT` with DETAIL `["/slotPath"]` and full no-effects snapshots. Direct
readbacks assert both stored fixture versions, including admission of exact max.
No storage widening, new rights, check bypass or other test change is made.
Root's current492 full run completed604 assertions/454 PASS/150 FAIL/no abort:
`dec193-selected-roots-version-boundary-first-red.log`, SHA256
`9882bfd2b43177f3230c9cb0f7d120231c73fffe0aaf92176efbfcf21de90576`.
Both max-1/max valid storage premises passed. Its public response RED is
explicitly nonisolated missing-roots prerequisite RED, not allocator23514-path
proof. These are parent-supplied results; all four NEW WIPs remain unexecuted
until root staging. Author performed no run or parser execution and claims no
post-fix GREEN.

Corrected030 TEST freeze:122 lines,8559 bytes, SHA256
`dd667a5d9d9cecfd045ac4545c95dd8ebd8eaa2bc4a76749452d41df877b454b`.

WIP prefix: `supabase/migrations-wip/dec193/`. Counts exclude the final empty
split entry; every file is below300 lines. Report SHA is supplied separately to
root to avoid self-reference.

| Basename | Lines | Bytes | SHA256 |
|---|---:|---:|---|
| `20261016043400_cms_pattern_placement_roots_check.sql` |108|5662|`459893d9f17be9efd1eafb860de38a1d13ae8340935bd306fbabc1867303cede`|
| `20261016043500_cms_pattern_placement_selected_plan.sql` |103|5321|`0531d7ccfe20a692da764d5dc7b52d3bf4ef332f8921f127b2698d5380d91762`|
| `20261016043600_cms_pattern_placement_path_allocation.sql` |75|3370|`f0e25950bc079833cf15347b2eddc64d7db547e725ddc926e2b533581fe0a94b`|
| `20261016043700_cms_insert_pattern_selected_roots.sql` |113|6600|`0928d377f6d46b1ba010c2f1aa64dad36e6c3bb07e8e90a8b1fa443c1917a558`|
