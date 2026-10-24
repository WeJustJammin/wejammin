# DEC-193 Worker update/diff handoff

Date: 2026-10-16. Native Codex author; root retained the requested
`gpt-6.1-sol` / `ultra` lane. Current status: **GREEN implementation UNRUN;
root RED observed; tests frozen**. The initial TEST-FIRST record follows, with
the production release recorded in the final section.

## Authority and exact scope

S12Dispatch claimed the five test paths below and this handoff before release.
Worktree: `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`.
Protected primary `/home/rob/Projects/WeJammin` remained read-only.

1. `apps/worker/src/cms-composition/pattern-update.test-support.ts`
2. `apps/worker/src/cms-composition/pattern-update-answers.test.ts`
3. `apps/worker/src/cms-composition-production-pattern-update.test.ts`
4. NEW `apps/worker/src/cms-composition/pattern-update-dec193.test.ts`
5. NEW `apps/worker/src/cms-composition-production-pattern-update-dec193.test.ts`
6. This handoff.

Only those paths were written, using absolute apply_patch edits. No production,
public contract, placement, SQL, Web, OpenAPI, tracking or other helper path was
edited. No application runtime, test, formatter, lint, build, network or git
command ran. Context-mode filesystem analysis and static byte/hash calculations
are not passing-test evidence.

## Locked authority and expected behavior

Approved DEC-193 and its five-correction propagation policy remain unchanged.
BE03c `03c-composition-taxonomy-localization.md:1182-1254` defines typed diff
values, structural collisions, slotPath/newRoots and existing wire caps.
BE03c:1487 specifies structural `yours` as an active detached resolved tree and
removed-root `theirs` as a retired linked row; both keep prior positive pattern
provenance. A removed root must not remain pinned to the target that lacks it.

The current production `validUpdateResource` still requires every accepted row
to remain linked and pin the target (`pattern-update-answers.ts:95-99`). Both
the route (`pattern-update-routes.ts:130`) and production adapter
(`cms-composition-production-pattern-update.ts:149-151`) reuse that guard.
No production implementation was changed by this lane.

## Legitimate fixture/oracle cascade

- Shared diff fixtures now use typed NodeValues, nullable collisionKind,
  slotPath and newRoots. The empty/no-update fixture inherits empty newRoots.
- Shared test helpers describe the two explicit per-root choices and their
  prior-pin replies. A structural diff fixture carries ordered children,
  collisionKind and a separate root awaiting explicit placement.
- The historical retired-accept positive uses prior pin 1 and an explicit
  `theirs` choice, instead of accepting a retired row pinned to target 2.
  The old detached-without-choices refusal remains, with its title clarified.
  Existing CAS, entry ETag, row-count, identity, privacy and detach refusals stay.
- The near-maximum production diff uses 64 props keys per NodeValue rather
  than the obsolete 100-key props-only shape. Three-character string values
  retain the independent compact/JSONB-spaced byte assertions. Static data
  calculation: compact 242507 bytes; spaced 278372 bytes; resource cap 262144;
  read transport cap 524288. No cap or assertion was weakened; this calculation
  did not import or execute the tests or application.

## New assertions and predicted RED frontier

`pattern-update-dec193.test.ts` has seven runtime cases:

- WU-01, two cases: strict-schema-valid active detached structural-yours and
  retired linked removed-root-theirs replies with prior positive pin 1 must
  satisfy the real answer guard. Predicted RED: current guard returns false.
- WU-02: a strict-schema-valid retired reply incorrectly pinned to target 2
  must fail the real answer guard. Predicted RED: current guard returns true.
- WU-03, two cases: the same valid replies must produce exact 200 bodies and
  committed entry ETags through the real route, with one exact command-port
  invocation. Predicted RED: current route answers 502.
- WU-04: the incorrect target-pin retirement must become a scrubbed local 502
  without ETag or resource disclosure. Predicted RED: current route answers 200.
- WU-05: typed structural diff values, children, slotPath and newRoots pass
  unchanged through the real read route. Expected retained GREEN.

`cms-composition-production-pattern-update-dec193.test.ts` has four cases:

- WUP-01, two cases: valid resolved replies traverse the real production
  dependency and route; exact named RPC, method, key, If-Match, command members,
  choices, response body and committed ETag; one fetch only. Predicted RED: 502.
- WUP-02: erroneous target-pin retirement gives scrubbed 502/no ETag after
  exactly one fetch. Predicted RED: current adapter/route answers 200.
- WUP-03: exact typed structural diff traverses one named read RPC unchanged.
  Expected retained GREEN.

The corrected historical retired-accept positive is an additional predicted
behavioral RED. Thus ten behavioral cases are expected to fail, distinct from
the fixture cascade and retained guards. Root must observe actual assertion
failures; import/setup/type failures are not acceptable RED evidence.

## Freeze hashes

Line counts count newline characters; every test/helper is below 400 lines.

| Path suffix under apps/worker/src | Lines | SHA-256 |
| --- | --- | --- |
| cms-composition/pattern-update.test-support.ts | 214 | `75290229cba8bdbe2ef8f2addc246254a5e74787929d47aa4b393c5eb8b62750` |
| cms-composition/pattern-update-answers.test.ts | 278 | `bf921b77dace5cd9154643a1b0ffe39f5b663ca963b571ff7f23999406e5c81a` |
| cms-composition-production-pattern-update.test.ts | 244 | `501454f7bfd2be9ad22b8b5c2b9291aaa42a90b9f77de2a627f81641d606f91c` |
| cms-composition/pattern-update-dec193.test.ts | 121 | `ee55c1ed2688d1899cf530354a4963a803745f3d4ac8f48d300372bdf6326d39` |
| cms-composition-production-pattern-update-dec193.test.ts | 130 | `8797612aaf0cee28a08d972cd81dcdb8175153790b44983cc7e04df5770ec3ef` |

Frozen production guard SHA-256:
`2d872390d9ce70d7438a1441c788762c003d1c49131caeb4686d0b26f02b9e54`.

## Root continuation and proof limits

Root observes focused behavioral RED before releasing any production GREEN.
The minimal expected production change remains the shared answer guard, with
existing transport/contract/CAS/privacy controls preserved. Root owns actual
formatting checks, focused GREEN, independent review, full validation, tracking
and promotion.

These tests use a controlled command-port or Supabase-fetch boundary. They do
not prove tree resolution, exact original provenance against stored rows,
membership/forest order, registry checks, SQL atomicity, placement semantics,
or hosted acceptance. No v2 or dual legacy schema was introduced.

## Native shared-guard GREEN authoring after root RED

Root's observed RED receipt:
`/tmp/wejammin-native-dec193-worker-red-YLjw7B/red.json`.
SHA-256: `a74b83d6bd5f1f13cdde4c2657095b6790d3749955e7027229c28a404b370f22`.
This author read the existing receipt, not executed the tests. Four files,
67 cases, 57 PASS and 10 meaningful FAIL; all four suite messages are empty,
with no setup/import abort. The ten assertion failures match the predicted
frontier: valid prior-pin outcomes refused, erroneous target-pin retirement
admitted, at guard/route/production boundaries plus the historical positive.

S12Dispatch separately claimed only
`apps/worker/src/cms-composition/pattern-update-answers.ts` and this owned
handoff before the GREEN release. All five test/support files stayed frozen;
their SHA-256 hashes still match the preceding freeze table. No public schema,
route, production adapter, ports, placement, SQL, Web or OpenAPI file changed.

The new private `validAcceptedRow` helper at `pattern-update-answers.ts:64-87`
keeps an active linked accept pinned to the requested target. The other
permitted accept outcomes require one instance, a strictly earlier positive
provenance pin, and an explicit matching choice: active detached requires
`yours`, retired linked requires `theirs`. A retired target-pinned reply is
refused, as is a detached reply to an accept without choices. This changes
only answer-state/provenance binding; parsing, ETag arithmetic, next-version
binding, one-row-per-instance, unique ids/paths, one revision, nonnull pattern
provenance and the existing detach branch are retained.

Earlier positivity is supplied by the strict public row schema. The transport
can verify that the pin precedes the target and that an appropriate choice
exists; it cannot independently reconstruct the exact previous pin or the
choice's collision kind/tree semantics from the public command metadata.
Those remain producer authority and proof obligations, with no extra read or
broader wire shape added here.

Production guard before SHA-256:
`2d872390d9ce70d7438a1441c788762c003d1c49131caeb4686d0b26f02b9e54`.
Production guard after SHA-256:
`6d2431ac72c560ecd62582a67a8e5c3e0131d0941bdd29120eb2533dde0aee06`
(123 newline characters, below the 300-line utility limit).

GREEN remains **UNRUN by this author**. No runtime, tests, formatter, lint,
build, network, git or SQL command ran. Root next performs focused GREEN and
independent review, then owns the wider validation and acceptance gates.
