# DEC-199 retained Slice 11 preflight TEST cascade

Author: native `gpt-6.1-sol` / `ultra`, `native_dec193_contract_green_20261016`.
Status: **author UNRUN**. Exact two-path Dispatch Log claim only. Worktree:
`/home/rob/.codex/worktrees/phase2-slice12/WeJammin`.

## Observed baseline, not a complete run

Root's staged509 ten-suite failfast diagnostic passed selected1203, consumer924
and six retained suites1939, then stopped in `phase_02_slice_11_helpers_preflight.sql`.
The preflight driver exposed three failed assertions among98 visible against
plan165, then aborted on duplicate `(category,version)=(pattern,2)`. It did not
complete165 assertions, and the later locale driver was not reached.

Root log:
`/tmp/wejammin-native-receiving-proto-red-BkaHbW/dec193-provider-509-ten-suite-regression.log`
SHA256 `f57cd5be419d8fa30a9623bd2707bd1e03c838d1d0dac55b31562e11acc764dc`.
This is pre-correction root evidence, not author execution, corrected GREEN,
canonical gate acceptance, promotion or hosted proof.

## Governing source and diagnosis

- BE03b1792 and P2-S11-AC-093: the greatest registry version owns a category;
  a later slice registers a successor. The registry remains private/immutable.
- BE03b1794 and P2-S11-AC-094: the generic reference gate applies while an owning
  provider is unbuilt; it still supplies fail-closed reference-count evidence.
- BE03c1536 / DEC-199: the implemented pattern provider is
  `cms.pattern.active_digest` v1/database, with the existing closed reasons.
- Typed mirror `packages/contracts/src/cms-editorial/preflight.ts:133–146` and
  WIP444:65–84 establish the real pattern registry row at version2.

Old test14 expected the superseded pattern reference-gate tuple. Old88/89 used
row path `/a`, while shared `phase_02_slice_11_helpers/003-registry.sqlinc:68`
defines the pinned block root `/root`. Effective manifest resolution424→423:47
uses407's exact root binding; that invalid fixture could not reach a provider
result. The shared `h11_json` error wrapper returns NULL, making constructed
binding evidence invalid. This explains `ERR P0001:INVALID_REQUEST`, not a
required production refusal for a valid fixture.

The same labelled legacy PatternVersion stores a deliberately stale registry
digest (`003-registry.sqlinc:70`); after correcting its root,441:74–78 should
report `pattern_digest_changed`. This is a source-backed prediction until root
executes the corrected test, not proof of a successful producer/governed pin.

Old520 tried to insert a test pattern registry row at now-real version2.
Old566–568 also deleted every seed-owner row above version1, which would erase
real pattern2 and locale2 after the abort was repaired. Both are test-fixture
assumptions, not grounds to weaken the registry or provider.

## Exact bounded changes

Only `supabase/tests/phase_02_slice_11_helpers_preflight.sql` changed:

1. The literal17-category parity string changes only the pattern tuple to
   `cms.pattern.active_digest@1/database/-`.
2. Only the `gate-pattern` and `multi` pinned fixtures use their actual `/root`.
   Their pattern reasons change to `pattern_digest_changed`; pattern count1
   remains an exact assertion, accurately labelled one offending live pin.
   Both multi-failure arrays retain every other category/result and count.
3. One new exact taxonomy `blockingCount`1 assertion retains generic D19
   reference-count evidence beside its existing fail-closed reason assertion.
4. The eight temporary registry probe batches use the next greatest version
   plus1 and record their generated IDs. Cleanup deletes only IDs recorded for
   that batch. Provider keys/versions/kinds/reference kinds remain the original
   adversarial inputs. No category-version cleanup or broad version sweep remains.
5. One new equality assertion compares every complete registry row against a
   pre-probe image, preserving real successors, timestamps, identities and all
   other columns byte-for-byte at the JSON row-image boundary.
6. The fixed TAP plan changes165→167 solely for the two added assertions.

The local helpers reuse the existing privileged `h11_raw_insert`/`h11_raw_exec`
reader-fixture mechanism. That shared mechanism disables USER triggers while
substituting fixture rows and restores them; it was not edited. These probes
do not claim ordinary-caller write authority or prove registry immutability by
their own privileged inserts/deletes. Production guards, grants and contracts
remain unchanged. The inherited oversized driver was modified surgically only.

## Preserved assertions and boundaries

All original assertion statements remain, with only the approved current-pattern
operands/labels and dynamic next-version operand cascaded. Seventeen categories,
unknown provider key, same key at an unknown provider version, implemented-key
dispatch gap with `INTERNAL_ERROR` in submit and publish plus recovery, the
sixteen non-worker unavailable results, accessibility's separate unavailable
reason, all17 v2 results, evidence binding, counts, auth/privacy, read-only
fingerprint and unsafe props/bindings controls are retained. Taxonomy, privacy,
media, route and locale cases are not removed or folded into the pattern case.

Source-only inverse inventory covers the new local fixture block, all eight
probe insertion/cleanup substitutions, one parity tuple, two root paths, three
pattern outcome literals, accurate labels, one dynamic version operand, the
two added assertions and plan increment. Original source-line assertion starters
number157; corrected source has159. This is text inspection, not a TAP count.

The exact pre-edit archive member was read without extraction or source writes:
`/home/rob/.local/share/wejammin-backups/s12-codex-resume-20261015.YioA2F/dirty-files.tar.gz`,
member `supabase/tests/phase_02_slice_11_helpers_preflight.sql`. Its77554 bytes
match the independently recorded pre-edit SHA below. A plain-text line comparison
finds only these25 hunks; applying their inverse to the corrected text reproduces
the complete pre-edit bytes and SHA exactly. No SQL parser or execution is involved.

| Old start + lines | New start + lines | Change |
|---|---|---|
|20+1|20+1|Plan adds two assertions|
|173+1|173+1|Pattern tuple only|
|176+0|176+33|Baseline, exact-ID tracker and two local helpers|
|177+5|210+1|Media view probe insertion|
|184+1|213+2|Captured next-version operand|
|187+2|217+1|Media view exact-ID cleanup|
|438+1|467+1|Current provider/gate section label|
|442+3|471+4|Actual root, pattern reason and label|
|446+1|476+1|Offending-pin count label|
|452+0|482+2|Added taxonomy count assertion|
|486+4|518+1|Media dispatch probe insertion|
|492+2|521+1|Media dispatch exact-ID cleanup|
|497+4|525+1|Unknown contract-version probe insertion|
|502+7|527+3|Accurate label, exact-ID cleanup and v1 control insertion|
|510+3|531+2|Accurate control label and exact-ID cleanup|
|518+4|538+1|Pattern dispatch-gap next-version probe|
|526+2|543+1|Pattern dispatch-gap exact-ID cleanup|
|537+5|553+2|All17 provider-v2 probes|
|566+3|579+1|All17 exact-ID cleanup|
|572+4|583+1|Unknown accessibility-key probe|
|579+6|587+2|Accessibility cleanup and unknown security-worker probe|
|588+2|592+6|Security cleanup and added full-row baseline assertion|
|848+1|856+1|Multi fixture actual root|
|851+1|859+1|Four-failure array pattern reason only|
|860+1|868+1|Failed/unavailable array pattern reason only|

## Validation and manifest

Author performed source reads, apply_patch edits, literal source comparisons,
hash/line/byte inventory and readback only. No parser, formatter, project runtime,
tests, SQL/DB, Git or network invocation. Root explicitly permitted the sole
archive command `tar -xO` for the read-only comparison above; nothing was extracted
to disk. No shared helper, production,
contract, promoted migration, old unrelated assertion or tracking file changed.
Root owns independent review and actual execution before any result claim.

| Source | Lines | Bytes | SHA256 |
|---|---:|---:|---|
| Pre-edit driver |891|77554|`2cae4edafeb6b670b8c29548fe8b18f8fc934ebfa3bc7c47ebb6468a6238fbc2`|
| Corrected driver |899|76898|`6fbb1fcb2761cb014cff32d02ad80f5062c47f2f5bace8c2421bed351420b7e9`|

The report's own final SHA is supplied separately to root, avoiding a
self-referential manifest. Corrected tests remain author UNRUN.
