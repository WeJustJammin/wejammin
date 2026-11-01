# DEC-199 typed pattern provider handoff

Date: 2026-10-16
Owner: Codex
Decision: DEC-199, live nested-pattern publication recheck

## Scope

This handoff covers exactly eight frozen paths: three production contracts/copy
files, three legacy fixture tests, and two new provider/copy tests. No other
files were edited by this lane.

DEC-199 requires the publication pattern provider to revalidate every reachable
live nested pin for active state and existing compatibility. The closed pattern
reason order is `pattern_not_active`, `pattern_digest_changed`, then
`nested_pattern_not_active`. Canonical detached trees validate their own retained
tree and do not reopen provenance pins. Source authority: `.memory/wiki/decisions.md`
5324-5334 and `.memory/wiki/specs/propagation-scan-2026-10-16-codex-dec199.md`
5-9.

## Production normalizations

- The main registry pattern row is registry version 2, database provider
  `cms.pattern.active_digest` version 1, owner slice `03c`, with a null
  reference kind and the three closed reasons.
- The Slice 12 composition provider mirrors that key, version, kind and reason
  order.
- Web copy has one fixed safe sentence per reason and never echoes a raw token:
  `A pattern used here is not active.`; `A pattern used here changed since this
  draft was saved.`; `A nested pattern used here is not active.`

## Fixture and test cascade

- The legacy editorial registry fixture removes `pattern` from the unbuilt
  reference-gate list, adds the literal three-reason pattern set, and includes
  `cms.pattern.active_digest` in database-provider key order.
- The legacy Slice 12 provider fixture adds the literal nested reason while
  preserving its assertion and negative-case bodies.
- The legacy closed-reason fixture replaces the pattern reference-gate token
  with the same literal three-reason set while preserving all other categories,
  assertions and negative cases.
- The new contract test covers registry/composition agreement, all three result,
  refusal, details and API payload parses, cross-category/unknown/unavailable
  rejection, exact-17 report shape and aggregate precedence. It also rejects
  16/18 results, swapped and duplicate categories, and `passed: true` on a
  failed report.
- The new web test covers the three fixed copies, repeat stability, generic
  unknown-token fallback, raw-token non-echo and HTML/control-line delimiters.

## Frozen paths

| Path | Lines | SHA-256 |
| --- | ---: | --- |
| `packages/contracts/src/cms-editorial/preflight.ts` | 479 | `13695f42b74e295173345f463bab660947760815ac079d78512fb66a439ed1ef` |
| `packages/contracts/src/cms-composition/preflight-providers.ts` | 58 | `74aea5729905c1f4c3f85ae27fb210793048087d59555c26687282c5bf7dc420` |
| `apps/web/src/components/cms-editorial-workflow/cms-workflow-labels.ts` | 219 | `306f46bb2308c3d57167712404e853fb71084ea73970c5c1c357bbe843eb581b` |
| `packages/contracts/src/cms-editorial/preflight.test.ts` | 709 | `4c942946a95141a871ac421e1d145a0d27f8761f426c9711c580844bdee84dba` |
| `packages/contracts/src/cms-composition/preflight-providers.test.ts` | 80 | `c6ea400265b5c925b879175908d8a2b6cd1889f1db526171c7e3565f3e1508c5` |
| `packages/contracts/src/cms-editorial/preflight-reasons.test.ts` | 183 | `d598e7b560f3a076e2c704c562643d6dc97aeaf8817d17c534ce6589129bf7e6` |
| `packages/contracts/src/cms-editorial/preflight-pattern-provider.test.ts` | 267 | `1c69bf43827069db3b770775b1c8b8f7569e846a6f31edafa829520b6fc46821` |
| `apps/web/src/components/cms-editorial-workflow/cms-workflow-pattern-reasons.test.ts` | 46 | `eefe9f86fd10a42e32e5f5d01e668880c001c799f172ca3411ab46383798ec26` |

## Validation boundary

Author validation is UNRUN: this lane was restricted to source reading, static
line/hash checks and `apply_patch`; no runtime, import, parser, formatter, test,
database, network, Git or container command was executed.

Root separately reported the consumer-first regression artifact
`/tmp/wejammin-native-receiving-proto-red-BkaHbW/dec199-typed-green-first-regression.json`
with SHA-256
`fc6dac05e63918942e8945fd2b8399c7fe70abacae194d03f2957c71654b91d8`: first
17-test checkpoint 11 passed/6 failed, then 53-test checkpoint 50 passed/3
stale-fixture failures. Those are root-reported results, not author-run
acceptance evidence.

Root then reported the fixture-cascade artifact
`/tmp/wejammin-native-receiving-proto-red-BkaHbW/dec199-typed-fixture-cascade-regression.json`
with SHA-256
`e540676dced2bd36ddc36a0854f23c1c6bff2bd162b35f6ec619e1a5c6cd21ad`:
65 tests, 64 passed and 1 stale pattern failed-reason expectation before this
literal fixture update. That is also root-reported, not author-run evidence.
