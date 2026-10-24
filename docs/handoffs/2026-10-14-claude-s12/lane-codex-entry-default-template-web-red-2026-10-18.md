# DEC-202 Web receiving QA — source freeze, UNRUN

Native `gpt-6.1-sol` / `ultra`. Exact four-path TEST claim is recorded before
authoring in the Slice12 tracker's opening Dispatch comment. Only the existing
submit test, two new component tests and this new report are written. No
production code, package, shared fixture, contract, SQL or other test is edited.

## Locked source and boundaries

Canonical `.memory/wiki/decisions.md:5324–5334` records DEC-202. The bounded Web
receiving contract is `.memory/wiki/specs/fe/03-cms-content-modeling.md`:

- FE1175–1181: exact active-schema default/SQLNULL is server-derived; no template
  picker/operand, historical rebind or added designer/registry capability.
- FE1186–1188: exact neutral404/409/setup422 strings; `/contentTypeVersionId` is
  non-field setup validation, while real field violations keep their linkage.
- FE1190–1192: preserve typed values/locale, focus the named error summary and
  announce safe status; only verified canonical success clears the draft.
- FE1200–1209: UNKNOWN retains its exact immutable body/evidence/key until settled;
  prop/preparation changes cannot alter that retry or cause another mutation.

Context reread/review/reconciliation1193–1198 remains a later separately claimed
lane. No new read control, route, endpoint or product behavior is specified here.

The tests use the real island, hook, lazy submitter, request/resource schemas,
transport and typed mutation-error parser. Injected fetcher and navigation are
external browser boundaries only. No controller, parser, result classification,
transport verdict or request-builder implementation is mocked or replaced.

## Existing source contradictions

All paths below are under `apps/web/src/components/cms-editorial/`:

- `cms-editorial-entry-create-submit.ts:83–89` still blames content-type absence
  or change for404/409, rather than the locked neutral setup strings.
- The same module146–154 assigns unreasoned setup422 the generic highlighted-
  fields copy. `cms-editorial-request-support.ts:34–45` ALREADY maps the setup
  pointer to `fieldId:null`; this QA does not manufacture a field-mapping bug.
- `use-cms-editorial-entry-create.ts:131–142/170–185` already supports a non-field
  summary and invalid-outcome focus. Its187–193 definite-error branch instead
  clears the summary and never increments the focus token for404/409.
- Its `Pending`38–42 captures only values/locale/key. `run`216–223 rebuilds
  evidence from current type props; retry253–255 reuses the old key with that
  current evidence. A valid changed-props rerender therefore discriminates the
  missing immutable full-attempt capture from the unchanged-props happy case.

The existing `CmsEditorialEntryCreateIsland.test.tsx:335–365` unchanged-props
same-body/key control is untouched. Proxy, SSR and context-read sources remain
unchanged; this lane does not claim navigation/remount recovery coverage.

## Authored tests and non-vacuous premises

### Existing submit suite:15 source-enumerated cases

`cms-editorial-entry-create-submit.test.ts` changes only:

1. The404 and409 matrix expectations207–227 to their full literal locked copy,
   using exact equality for those two rows. The401/403 assertions, refusal
   classification and key-lifecycle checks are retained.
2. One new setup422 case229–247, using a real closed ApiError body with the
   exact `/contentTypeVersionId` violation, no reason token, exact neutral copy,
   `fieldId:null` and a definite-refusal next-key control.

The ordinary typed field422 block184–205 is BYTE-UNCHANGED, SHA256
`2b40d60231a419ae0c252e58463b594f9dfb3a39652bcb08850993d77cd72809`.
All original case identities remain; one additional test is introduced.

Text-only inverse verification recovers the entire original289-line test with
SHA256 `b990a3d4b300cc22db13f7eeb5e1920b0d7146fa7bbbcb41f4a848b9181bc43e`:
remove the new case beginning `it('keeps a derived setup 422` up to the next
`it('keeps the key and the wait`; restore matrix404's old `not available` and
matrix409's old `Reload` expectation; replace the two-branch message assertion
with its original `expect(result.message).toContain(copy);`. No other original
test bytes differ. This is source comparison, not an execution receipt.

### New setup suite:7 source-enumerated cases

`cms-editorial-entry-create-setup.test.tsx` uses shared real DOM drivers and
schema-parsed authoring fixtures. The test response helper parses its injected
closed ApiError through the shared schema;404/409 details are empty. An untrusted
diagnostic marker exists only in the upstream message or violation message to
prove it is never rendered; the fixture does not publish a new public reason.

`renderRefusal`89–122 fills a genuinely valid required short-text control and
selects supported `fr-FR`, then invokes the actual create form. Every scenario
first checks exactly one actual POST, correct literal values/locale, no If-Match
and no navigation. No local-validation refusal is mistaken for receiving RED.

- Lines125–138: three404/409/422 cases assert exact independent literal status copy,
  polite atomic announcement, preserved title/locale and diagnostic non-disclosure.
- Lines140–157: three separate cases assert retained values, no title `aria-invalid`,
  the existing named/labelled summary with no field links or nonexistent template/
  version control, and actual DOM focus on that summary.
- Lines159–175: ordinary `/fields/{stableFieldId}`422 control keeps existing generic
  field copy, real link/annotation, summary focus and retained title/locale. It
  must not be rewritten as setup validation. The existing typed-reason field
  control in the submit suite remains separately intact.

### New UNKNOWN suite:2 source-enumerated cases

`cms-editorial-entry-create-attempt.test.tsx` uses one unchanged-props control and
one changed-props discriminator under the same actual component path. `changedType`
54–71 constructs an independently shared-schema-valid replacement with different
type/version/artifact IDs, artifact hash, validator refs and policy evidence.
These are local typed fixtures, not claims of real registry activation.

The injected fetcher records actual serialized POST bodies and keys and throws
on the FIRST real dispatch. Its next answer is a strict201 resource with matching
Location, strong ETag and no-store; the real transport decides its outcome.
The first captured request is independently parsed and checked against the
original type/evidence and literal unsent work. The UNKNOWN form must be locked,
retain values/locale and announce uncertainty without navigating.

At136–155 a same-mounted-root rerender supplies the valid changed props (or
unchanged control). No automatic call may occur. Only explicit `Retry create`
activation permits a second call; its key AND serialized body must be identical
byte-for-byte to the first, not merely hash-equal or semantically similar JSON.
Only verified201 may navigate once; an extra flush must produce no third call.
No new-key entropy mock or hidden network fallback supplies the expected result.

## Expected RED, not observed results

Source enumeration is15 submit +7 setup +2 attempt =24 focused cases. No test
runner or parser was executed by this author. On the unchanged production code,
the source predicts9 meaningful failures and15 passing controls:

- Submit: obsolete404/409 copy rows and new setup422 copy fail;12 others pass.
- Setup: three exact-copy cases and404/409 summary-focus cases fail; setup422
  focus/no-fake-field and ordinary field422 controls pass.
- UNKNOWN: changed-props byte equality fails; unchanged-props control passes.

These are predictions conditional on all stated schema/dispatch/DOM premises.
A setup/import/collection failure is not the intended RED and must be diagnosed
without weakening the oracle. Root owns the first actual focused run and its
complete case identities/counts, independent readback and later GREEN release.

Declared root script is `test: vitest run`; proposed focused command (UNRUN):

```sh
pnpm test apps/web/src/components/cms-editorial/cms-editorial-entry-create-submit.test.ts apps/web/src/components/cms-editorial/cms-editorial-entry-create-setup.test.tsx apps/web/src/components/cms-editorial/cms-editorial-entry-create-attempt.test.tsx
```

Root should also retain the existing island, transport, submit-focus and proxy
outcome-unknown/error-relay regressions when verifying the eventual implementation.

## Author freeze manifest and limits

| Owned test | Physical lines | UTF-8 bytes | SHA256 |
| --- | ---: | ---: | --- |
| `cms-editorial-entry-create-submit.test.ts` |314|10759|`85e3d36193c9424dc182ca2da2da9fa37dee5c7376e999a38f8987843b0105aa`|
| NEW `cms-editorial-entry-create-setup.test.tsx` |176|6323|`cda81fe43b7c9cf0aa3727638567be0b6a0e445fdf52af17c6121aba2aee2172`|
| NEW `cms-editorial-entry-create-attempt.test.tsx` |157|5914|`0202a91ca04029cadfec63c9cab8f5abb995a786e2ca8f557502d484364c1625`|

All author work is source-only **UNRUN**: no formatter, parser, lint, type-check,
tests, project runtime, Git, network, database, Docker or child agent execution.
Only source reading, text/hash comparison and scoped apply_patch authoring occur.
This report's final hash/count is provided externally, not self-referentially.

These browser-boundary unit/component tests do not prove SQL default pinning,
actual capability grants, atomic DB rollback, dependency locks, hosted Auth,
real-browser accessibility or acceptance. They add no context reread flow,
cross-navigation persistence, template selector/member, endpoint, authority,
public reason/status or production implementation. Receiving gates remain OPEN.
