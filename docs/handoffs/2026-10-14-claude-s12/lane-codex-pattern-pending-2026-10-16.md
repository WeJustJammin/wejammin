# Pattern designer unknown-outcome lane report (2026-10-16)

## Current source freeze

FROZEN / verification UNRUN by native gpt-6.1-sol / ultra. The current GREEN
correction claim owns only pattern-latest-read.ts, use-pattern-conflict.ts,
and this report. All tests and other production paths are frozen. The protected
primary checkout /home/rob/Projects/WeJammin remains read-only.

Worktree: /home/rob/.codex/worktrees/phase2-slice12/WeJammin.
Source paths below are under apps/web/src/components/cms-pattern-designer/.

| current changed path | physical lines before root formatting | SHA-256 |
| --- | ---: | --- |
| pattern-latest-read.ts | 202 | 698696734e1758b7ff878e3d4618d0b0c03347cc7b7ada4a7daaa3ee5899377a |
| use-pattern-conflict.ts | 204 | a291aa31ef15ce5cdea7cb0da78ffcd4a76793a02dec0dcc330ba6490ea6c83a |

## Observed RED authorizing this correction

Root ran the three review-follow-up files: ten cases, seven PASS and three
meaningful FAIL, no setup/import abort. Receipt:
 /tmp/wejammin-native-pattern-review-red-egrWqt/red.json
SHA-256: 6f174a18eea1e64277682c1dd95bc93e523db3e92adc48c2674f3b7a4ac75a8e.
This author read and rehashed the receipt; this author did not execute it.

- pattern-latest-read.cancellation.test.ts: both cases FAIL. The actual default
  reader receives a retryable HTTP 503; unmount one ms before the 250 ms or
  750 ms backoff boundary still allows another GET.
- CmsPatternVersionDesigner.latest-rate-limit.test.tsx: three PASS, one FAIL.
  The stated five-second message remains unchanged after one second instead of
  projecting four seconds remaining.
- CmsPatternVersionDesigner.uncertain-boundaries.test.tsx: four PASS. The held
  POST/GET invalid-JSON native-submit trace, both A/B adoption actions, and the
  immediate automatic-429 empty-first same-node witness already hold.

## Correction and compatibility

The hook now owns an AbortController for every latest check. A replacement
check, explicit clear, or unmount aborts its active controller; the existing
mounted/sequence guards still reject stale continuations before state or timer
effects. Editing a form key does not replace the original attempt's read.

Only the actual default readLatestPatternVersion identity receives the private
third controls argument. Injected readLatest seams still receive exactly one
pattern key. The existing optional second fetcher argument remains unchanged.
The signal is a local fetch option; no authority header, body, query, endpoint,
or public response shape changed.

The default reader passes that signal to fetch and to a local cancelable sleep
through retryingSafeRead's existing sleep option. Abort clears a pending sleep
timer, removes its listener, rejects into the existing unavailable result, and
prevents a later retry GET. Signal checks before and after each fetch and after
response-body reads also suppress canceled results. The shared retry module is
unchanged: only declared-safe 502/503/504 reads retry, at 250 ms and 750 ms, at
most twice. Both unmount windows now have an implementation path to cancel the
actual default-reader timer, rather than only hiding its eventual state.

The hook owns a validated Retry-After deadline and projects whole seconds with
ceil((deadline - current time) / 1000). Its timer updates once per second or at
the remaining deadline, whichever comes first. The admission ref blocks reads
until the deadline. After expiry the check is available and numeric wait text is
empty; no further timer is scheduled. An absent, invalid, or out-of-range wait
uses generic rate-limit copy and creates no countdown. Clear/replacement and
unmount clean up the timer, and the timer callback checks mounted state.

The earlier immutable-attempt repair remains unchanged: original request/body/
idempotency key/base identity own automatic and manual verdicts; the POST and
canonical GET stay pending; unresolved outcomes reject native command admission;
not-saved retains the unchanged-body replay key; own-created closes the form and
uses the original key's URL. Explicit rebase/discard binds the adopted key and
positive parent, and the adopted lineage makes the key read-only. The canonical
read starts only after the empty polite region commits and that region remains
mounted into an immediate 429.

## Frozen test evidence

These three review-follow-up files were not changed during the source correction:

| path | SHA-256 |
| --- | --- |
| CmsPatternVersionDesigner.uncertain-boundaries.test.tsx | f74e41044eb7ae01f478febf8d27bf271997e47ccd4fd1b707bd1319d064a518 |
| pattern-latest-read.cancellation.test.ts | 37a15bdc7ef3afa8d06f2788fb70656e7d9b2909b84a6d42e2553ee863545b03 |
| CmsPatternVersionDesigner.latest-rate-limit.test.tsx | e91c15de4c36115d680c7f95a42a2c9e841621b4fb6f501e32ffc3acd0f334ad |

Read-back also confirmed six other captured neighbors unchanged: the original
uncertain-reconcile, results and reconcile test files, use-pattern-designer.ts,
use-pattern-unknown-outcome.ts, and CmsPatternVersionDesigner.tsx. The current
uncertain-reconcile oracle SHA is
b61cfb7298f01b894df014ca5d3fe804fd6eabefdd73ae810494ed45df9145f9;
the corrected results fixture SHA remains
b0774d8ec0e30630f787eae0b4dee6e831bb0cec60767d6a04011c26db9d348d.

The six review-follow-up cases are behavioral witnesses:
two real default-reader cancellation windows; one invalid-JSON trace using real
form.requestSubmit() during held POST and held GET with one POST/one GET and
retained pending; explicit rebase and discard after A request/local B edit/
different-content A response through the actual A GET URL, requiring fresh
idempotency and A's positive parent; and an immediate automatic 429 whose reader
records the already-connected empty polite region before returning, then checks
the same node and attributes afterward. Assertions are outside the injected
reader so caught assertion errors cannot hide a failure.

The existing countdown case retains its original five-second, tree, wait/control
and successful second-read assertions. Added proof checks four seconds remaining
at one second and no numeric stated wait at five seconds. The old 4,999 ms
disabled checkpoint is preserved as 1,000 + 3,999 ms.

## Condensed earlier checkpoints

- Root's initial native RED had sixteen retained result cases PASS and nine new
  race/lifecycle cases FAIL without setup abort:
  /tmp/wejammin-native-resume-red-k1uRiH/red.json, SHA-256
  7984b894edff9c55751a08245519eb52e3b9810106215da8428937c82bf27bb8.
- Root then observed the pattern folder GREEN, 22 files / 306 PASS:
  /tmp/wejammin-native-pattern-green-RWpa6P/green.json. This predates the current
  review correction and cannot clear it.
- To keep the formatted oracle below 400 lines, firstVersionDetail,
  mountEditHeldRead and mountNewHeldRead moved into the named
  pattern-uncertain-reconcile.test-support.tsx. Entire describe-to-EOF bytes and
  lifecycle hooks compared identical to root's oracle-before.tsx snapshot.
  Root's subsequent mechanical formatting changed only source presentation.
- The two historical idempotency cases retain every original key assertion.
  Their only fixture correction injects a verified unchanged-base read instead
  of treating an unavailable jsdom fetch as proof that nothing committed.
- Root transferred the inherited GREEN task after a Phils provider 403; native
  source work used the authorized gpt-6.1-sol / ultra route without a fallback.
  Historical RED-only route/status statements are superseded by this report.

## Verification boundary and next step

Author checks were filesystem read-back, hashes, and static reasoning only.
No tests, formatter, lint, type-check, build, runtime/DB, network, or git command
ran during this correction. No shared library, other source, test, schema, spec,
CSS, tracking, or primary-checkout path was edited.

Root next: run the full pattern folder, scoped formatting/lint/type checks, and
independent review of this exact source freeze. The claim and all acceptance
criteria remain open. No post-correction GREEN, runtime, or acceptance clearance
is claimed here.
