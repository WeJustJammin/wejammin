# S12 successor recovery static review — 2026-10-21

Diagnostic static review only. ROOT (`gpt-6.1-sol` / `ultra`) fully read the four
source files while the original privileged batch remained live. This note documents
ROOT's findings; it is not an independent approval and carries no acceptance credit.

## Scope and pins (all under `apps/web/src/components/cms-composition/`)

| file                                         | lines | SHA-256                                                            |
| -------------------------------------------- | ----- | ------------------------------------------------------------------ |
| `use-template-unknown-attempt.ts`            | 241   | `e460d5cd5309d973bfb9d178a63409c2592d6be7b82009bda84f83cbc2b58781` |
| `use-template-unknown-attempt.ts` (repaired) | 246   | `203a597bd62a4335d814f62ddc84ed529dede295898844846c30ba40694d877b` |
| `cms-template-edit-reconcile.ts`             | 78    | `e49bb501beb4696b9870e3783c50a40155fe753ffdf6e771226920f8ede4febf` |
| `CmsTemplateEditDesigner.tsx`                | 158   | `cb8558748671c1346aad34ee33cf96411ad23bf5393431119a022ba588efa84c` |
| `cms-template-edit-reconcile-state.ts`       | 205   | `47a074cd39146dfde07683576d280b3b93f90fe2dccc36acb8d7212ce452c081` |

## FE03 spec anchors consulted

- FE03 actual current lines 1158–1169: read-only GET scope.
- FE03 line 1214: loading state with no false success.
- FE03 line 1215: `Retry-After` handling with input preservation.
- FE03 line 1216: safe dependency retry with at most two retries, after 250ms then
  750ms (not two total attempts), mutation status-first.

## Source anchors examined

- `use-template-unknown-attempt.ts` line 57: generation changes preserve a
  possibly-sent attempt; line 92: immutable snapshot of the exact body/key/base.
- `use-template-unknown-attempt.ts` line 141: sync guard before lazy validation plus a
  phase-unknown blocked path.
- `CmsTemplateEditDesigner.tsx` line 49: blocked submit; protected latest-read
  controls.
- `cms-template-edit-reconcile-state.ts` line 16: same-number id/hash or a newer
  version; line 100: `checkLatest` also verifies `templateKey`/`templateId`; line 158:
  explicit higher-version rebase preserving unsent fields.
- `cms-template-edit-reconcile.ts` line 24: issues a GET to the same origin with
  no-store, treats redirects as errors, sends no mutation headers, and performs three
  distinct `readLatest` validation checks — a strict detail schema; `detail.templateKey`
  equals the requested key; and `detail.version` equals
  `String(detail.templateVersion)` — plus an exact quoted-version `ETag`. It does not
  claim `templateKey` equals `templateVersion`.

## Verdict

Preliminary initial four-file pass: **NO VERIFIED FINDING** in these four files as
examined by this initial static pass. That preliminary no-finding is now superseded for
the `CmsTemplateEditDesigner` detail-change path (see below); it is not a general
all-files CLEAR or approval of Slice 12 or the domain.

## Limits

Not reviewed: the mutation driver, builders, downstream validators, SQL, and actual
server CAS effects, plus any test-assertion inventory or execution. No runtime, browser,
database, native, atomicity, concurrency, criterion or phase credit; no counts, receipts
or signatures changed, and no code fix is warranted by that initial static pass alone.

## Subsequent investigation (after the initial four-file pass)

- ROOT expanded the read to `CmsTemplateLatestCheck` (54 lines): `offered:false` hides
  the check button; the status result shape is as implemented.
- ROOT isolated the model with the type-erased, unchanged hook source (SHA `e460d5cd…`)
  under real Node 26.11.1 with fake React hooks/transport/builders — no actual React or
  gate proof.
- Baseline unchanged detail gives result uncertain, blocked true, pending false and Check
  latest offered true; detail props changing while held POST gives phase unknown, pending
  false and blocked true with external status still pending, a stale completion ignored,
  and `offered:false` as a hidden recovery candidate.
- Initial context: Bun `stripTypeScriptTypes` unavailable was a tooling error; the Node 26
  rerun corrected its barrier to await the actual transport entry, after which both cases
  were observed. Errors are hidden nowhere and no VM result is claimed as a real test.
- A `Phils-Charm/deepseek-v4.1-flash` / `high` execution agent authored the real React
  RED regression; ROOT confirmed it as actual RED (below) and has now authorized a
  minimal repair of the hook only. Production code is unchanged and no GREEN exists yet,
  with criterion/receipt/native/DB gates held.

## Actual React RED (confirmed)

- Pinned Node 22.23.1, pnpm 11.24.0, Vitest 4.1.11; new
  `apps/web/src/components/cms-composition/CmsTemplateEditDesigner.detail-change-pending.test.tsx`,
  ROOT-formatted, 271 lines, SHA-256
  `96df82d4c12f475e8e72eeb1fc6686453a10a78c104365e4d8af8c4f58c491ae`.
- Two parameterized cases (created/lost), terminal exit 1 / no handle, 2 fail 0 pass:
  `The result is unknown.` missing exactly at line 236 (visible old `Saving` successor
  draft). No fixture/runner error; actual component/hook/state/builder/transport run, only
  the fetch boundary plus deterministic UUID/global act flag mocked, deferred I/O settled.
- Raw RED receipt `.lane-logs/s12-template-detail-change-red-20261021.json` SHA-256
  `6df0f42b8311c57e3e7ec127a94b4ab7a91c262dc7d59fc9e5556f7a04ca3097`; the 269 → 271 count
  from formatting is expected, not assertion weakening.

### Verified UI recovery defect

A pending POST with a detail-generation change sets unknown and pending false / blocked
true but never publishes `result uncertain`; the button is offered only for a result
conflict/uncertain, so the manual read is hidden, while stale-completion handling is
correct. A real defect for this path, with no counts, receipts, signatures or credit.

Repaired in the frozen hook pin below — a single sending→unknown block that also publishes
the existing `result uncertain` status, with no contract, authority or protocol change — and
confirmed by the actual negative-control replay and GREEN replay that follow.

## Actual replay and GREEN (confirmed)

- Frozen repaired hook `apps/web/src/components/cms-composition/use-template-unknown-attempt.ts`
  SHA-256 `203a597bd62a4335d814f62ddc84ed529dede295898844846c30ba40694d877b` (246 lines). The
  regression test is unchanged at 271 lines / `96df82d4c12f475e8e72eeb1fc6686453a10a78c104365e4d8af8c4f58c491ae`.
- Actual negative-control replay (the repair temporarily reverted so the hook matched the
  original `e460d5cd…`): `.lane-logs/s12-template-detail-change-red-replay-20261021.json`
  SHA-256 `e3d7b6eff1f636c865af67278f14362166c7453e34ef4637c5c53ea09ca9f33c` — genuine exit 1,
  2/2 failed at the same changed line 236 (expected `The result is unknown.`, received
  `Saving successor draft…`) for both the created and the lost late-response cases, no runner
  error, deferred finally settled.
- Final GREEN (repaired hook restored): `.lane-logs/s12-template-detail-change-final-green-20261021.json`
  SHA-256 `66ddde8a3d1bbeafbd47bddcb3c64e77bdb7dff64480b058112e202a3dad7dac` — 15 files,
  92 passed, 0 failed, genuine exit 0 (the regression file plus all neighbor suites).
- Honest caveat: that GREEN run emitted one React `act(...)` warning, from the unrelated
  pre-existing create-designer test `CmsTemplateDesigner.interaction.test.tsx` →
  `keeps the draft values and idempotency key across an uncertain retry` (a different
  component), not from this regression test. It is recorded here as an open item awaiting a
  separate investigation; the run is therefore **not** "warnings clean".
- Located boundary (source-only; NOT fixed, pending separate investigation): in that test,
  line 116 `root.unmount();` is the only unmount in the entire `cms-composition` test suite
  not wrapped in `await act(async () => { root.unmount(); })` — every neighbor, including the
  sibling test at lines 210–212 of the same file, wraps it, and `IS_REACT_ACT_ENVIRONMENT` is
  true. Minimal test-only proposal: wrap line 116 the same way. Not applied here.

These are local, source-level results only: no canonical `db:verify`/`validate`, no phase or
domain acceptance, no native/receipt/signature credit. The initial static pass and its
tool-error note stand as a preliminary review, and canonical DB/phase gates remain held.

## Batch status (updated)

AS OF the initial pass, the original privileged batch was still live with no output; that
observation is retained as history. The privileged recovery is now closed, the first PR01
run is terminal 1 with `IDENTITY_CHANGED`, and the native gate remains held. No
authentication cause is inferred.

The act-warning source check above stayed source-only: no ACT patch was applied.

## AS-OF 2026-10-21: create-template act-warning fix complete

Superseding the prior warning-open statements above, which are kept as history: ROOT
finished the separate create-template act-warning fix with actual RED, GREEN, negative
replay and final GREEN.

- `CmsTemplateDesigner.interaction.test.tsx` is now 225 lines, SHA-256
  `6e5e50b92a7fb753fdfdde19636f44ceee909e8d0473ccaf42992c3526915847`. The first test now
  spies on `console.error` only at teardown, forwards real output, asserts no calls and
  restores the spy in `finally`; the unmount is wrapped in `await act`. All request, value
  and idempotency assertions are preserved.
- Initial RED: terminal 1, first test failed at 119 with exactly one actual act warning,
  second passed; raw `.lane-logs/s12-template-create-act-red-20261021.json` SHA-256
  `91d03c9596d2fdd54fc66c6f8272ef1df242a8a4c64ead1a4377dfa924533df6`.
- First GREEN 2/2 terminal 0; raw
  `1ea43ac16fc31b505c20e6c9d6eb6af0aa294999e2a0950675b9b42ee236a6d4`.
- Negative replay reverted only the wrapper to the exact
  `c3a5823476f71954490ea7b041dac78bbe65d8bc340315359f6d39a0a44f8dcb`, actual terminal 1 on
  the same 119 warning assertion; raw
  `.lane-logs/s12-template-create-act-red-replay-20261021.json` SHA-256
  `d467fc3f44ed709dc99c2c6e7b17e2546662bcb33b02df0c9a382a9e0bee6632`.
- Restored SHA `6e5e5…`; FINAL `.lane-logs/s12-composition-warning-free-green-20261021.json`
  SHA-256 `a7c5a3cb2c1507e2f5b479e8218b7c1e3dd86f83668199aa1d108dfea45490f9` — 15 files,
  92 pass, 0 fail, genuine 0, no warning or stderr output.
- Scoped Prettier on 3 UI sources unchanged, plus ESLint `max-warnings 0`, all terminal 0. A
  fresh full TSC/progress after this teardown change has NOT run yet (the prior TSC 0 predates
  it), so those are not current.
- All 32 production native original pins were restored and verified unchanged after the
  diagnostic; helper-only seal regression tests are being authored with no repair yet.

Local/source-level evidence only: no counts, receipts, signatures, checkbox, denominator,
depth or canonical receipt changed, and the native PR01 gate remains RED and held.
