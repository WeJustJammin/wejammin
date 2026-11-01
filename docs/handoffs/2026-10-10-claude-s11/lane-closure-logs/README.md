# Slice 11 closure logs

Raw output of the orchestrator's closure runs on 2026-10-12: the two defects receipt pass 2 exposed and their
test-first fixes. The narrative is the "Canonical validation" section of
`.memory/pipeline/progress/verification/2026-10-12-slice-11-red-green-record.md` and `../STATE.md`.

## Contents

- `flush-red.out`: `CmsEditorialReviewSubmitForm.test.tsx` with the new slow-loader case, before the fix: the
  existing submit test and the new case both fail (the lazily imported validators had not loaded when the test
  asserted the request).
- `flush-green.out`: the same file after the shared DOM `flush` began awaiting the in-flight validator import.
- `web-after-flush-fix.out`: all web tests after that change; one focus test still failed for the same reason
  through the separate `settle` helper of `cms-workflow-focus.test-support.ts`.
- `web-slowloader-probe.out`, `web-slowloader-probe2.out`, `web-slowloader-probe3.out`: probes with the default
  validator loader delayed by 30 ms (a temporary local edit, reverted after each run) to find every test that
  raced the lazy import; the last probe's remaining failures were fixed in
  `CmsTemplateDesigner.validators-unavailable.test.tsx`.
- `loader-leak-red.out`, `loader-leak-green.out`: the loader test proving that a load started before a test reset
  no longer installs its module after the reset.
- `isolation-sweep-red.txt`, `editor-outcomes-isolated-red.out`: after CI failed `cms-editorial-entry-editor-outcomes.test.ts` on PR 129, every CMS web test file was run alone (six at a time): four editor files failed deterministically because the save flow imports its transport lazily and the fake clock settles a bounded number of turns, and one registry file failed under the parallel load for the same reason with its lazily imported contract validators.
- `web-after-preload.out`: all web tests after the editor harness and the registry refetch support preload those modules once (424 files, 4,611 tests passed); the 16 files that use the two supports also passed two rounds six at a time.

## Ownership

The orchestrator owns this directory. The logs are evidence for the record, not acceptance evidence by themselves.

## Extension

A new closure run adds its output here under a name that says RED, GREEN or probe and what it covers.

## Conventions

Logs are never inputs to a test. Credentials, tokens and personal data never enter a log.

## Related links

- `../STATE.md`
- `../lanes/refresh-receipts.sh`, `../lanes/refresh-pass2.sh`, `../lanes/refresh-pass3.sh`, `../lanes/gate-validate.sh`
