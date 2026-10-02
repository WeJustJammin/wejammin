# Slice 09 AC250 — production-built Chrome diagnostic

Date: 2026-10-01. Status: baseline RED observed; remediation in progress.
Scope: local production-built Astro/React UI with signed local session fixtures.
This is not hosted MFA, binding provenance, successful activation, or release evidence.

## Baseline execution

- Runtime: pinned Node 22.23.1 / pnpm 11.24.0; Google Chrome channel.
- Started: 2026-10-01 20:53:41 UTC. Execution handle: 80415, terminal exit 1.
- Command: `pnpm exec playwright test --config=playwright.s09-real.config.ts phase-02-slice-09-confirmation-disclosure-real-route`.
- One server launch, one worker, retries 0. Result: 6 failed / 0 passed.
- Resumption progress consistency check: exit 0.
- Root independently inspected the retained trace and failed-run metadata.

## Observed failures

1. Verified disclosure lacked the private freshness timestamp and rendered
   `Step-up required before commit`, correctly failing the bounded-time assertion.
2. The readable acting-context cases rendered the unavailable fallback because
   the local fixture did not wire the existing authenticated identity read.
3. Console errors included `/favicon.ico` returning 404 and an inline style
   rejected by the existing CSP at the built registry island bundle.
4. After acknowledgement was checked and focused, Escape left it checked.
   Source tracing found that the post-hydration canonical refetch replaces the
   React-owned workbench with parsed server HTML and preserves only a hydration
   marker, not React event ownership. The live Chrome probe confirms ownership
   before and absence after that replacement. Absence of the optional
   `onCancel` callback alone cannot explain the acknowledgement reset failure.

No console failure was filtered out and no assertion was weakened to obtain GREEN.

Root's trace-DOM/hash comparison identified the rejected style tag exactly as
`astro-island,astro-slot,astro-static-slot{display:contents}`. The retained DOM
snapshot has no visible nonce attribute, but browser nonce hiding means that
snapshot is not sufficient to establish the live element's nonce property.
The initial response's rewritten style nonce matches its CSP header. The
canonical refetch parses a second full HTML response with a fresh request nonce;
the probe confirms refetch parsing under the current document policy causes
the violation. No CSP relaxation or vendor modification is authorized.

The detail page lacks a favicon link while the existing `/favicon.svg` asset is
available. Reusing that asset is the proposed bounded remedy for the favicon
request; no production edit has yet been made in this diagnostic stream.

## Read-only discriminator probe

DeepSeek ran one production-built Google Chrome probe with pinned Node 22.23.1
and pnpm 11.24.0, using the existing real-route server harness. Command:
`pnpm exec playwright test --config=playwright.s09-probe.config.ts`. Terminal
exit 0; 1 diagnostic test passed. This is not the six-check acceptance run.
The temporary probe spec/config are preserved at `/tmp/wj-ac250-probe/` and
were removed from the worktree without changing the baseline artifacts or
the two committed runner-config targets.

- The live initial style matches the document CSP before and after refetch;
  no initial vendor-render nonce defect is established.
- Parsing the exact style with the document nonce adds zero CSP errors;
  parsing it without a nonce or with the second response nonce adds one each.
- The checkbox has two React-owned properties before replacement and zero
  after. Escape resets acknowledgement before replacement but not after.
- The initial tab-selector refetch remains required. Deleting it or adding
  native handlers to mask orphaned React ownership is not the selected remedy.
- Root independently compared the retained baseline response headers/styles:
  both styles match their own response nonce, the two response nonces differ,
  and the baseline CSP error follows the second HTML GET.

The planned fix must preserve React ownership for both successful projections
and fail-closed boundaries, retain existing refresh triggers, and keep the
locked nonce policy unchanged. Its exact projection mechanism is under review.
Root rejected a proposed guard that would retain an older full/fresh projection
when a canonical read becomes empty, invalid or failed. Denial must remove
protected controls; malformed or ambiguous projections must render a safe
boundary. Such stale-authority retention is not an accepted fail-closed policy.

## Signed fixture handoff

DeepSeek reports unit RED (new module absent) then GREEN at 9/9, focused lint
and formatting clean, and web/Worker project type-checks exit 0. Root source
review confirms the shared verifier retains signed-token, subject, local
session-ID, integer expiry, revocation and reference-presence guards. The
three reserved profile IDs alone receive the new label/freshness behavior;
unknown valid sessions preserve the prior no-label/no-freshness fallback.
The verified profile's five-minute freshness expiry is anchored once per
fixture instance/session and is not renewed by later reads. Activation still
returns unavailable. These are test-only fixtures, not genuine Auth evidence.
Reported unit timestamps are UTC: RED 21:37:08, GREEN 21:40:37. No live unit
execution handle remains. The fixture documentation preserves pre-existing
dirty content and explicitly separates local timing from real MFA/revocation.

## Intermediate fixture-stage Chrome run

Started 21:43:45 UTC, execution handle 13018, terminal exit 1: **6 failed / 0
passed**. The same six-check spec ran byte-identical, on pinned Node 22.23.1 /
pnpm 11.24.0, one worker, retries 0, Google Chrome only. The separate artifacts
are retained at `/tmp/wejammin-ac250-fixture-stage-xekyHI`; the baseline remains
untouched.

Verified and required sessions now display `Northwind Collective`; verified
displays the bounded UTC expiry, required displays the required state. The
unavailable session renders the fail-closed label fallback in SSR and the DOM.
All opening disclosure assertions pass. The favicon 404 is absent after reusing
the existing asset.

Failures remain: the browser-clock expiry leaves the static verified text;
Escape leaves acknowledgement checked; the required, unavailable, Tab-flow
and responsive cases fail on the existing refetch CSP error. Root did not
accept a speculative clock-mechanics modification: ownership loss can leave
the interval updating an orphaned React subtree. The same spec must run again
after the production repair before any clock diagnosis changes it.

The revised React-owned repair is authorized within the recorded file claim:
reuse the shared public schemas; apply canonical empty/error/denial; disable
on invalid or ambiguous props; preserve refresh/cleanup/focus semantics. No
new route, authority prop or privacy model is authorized. Fresh full validation
and criterion acceptance remain outstanding.

The author reports the pure projection/scanner layer at **26 tests passed in
two files**, before mounted Island integration. The oversized helper was split
into scanner (157 lines), codec (58), state validation (296), and projection
composition (63). Root read-back confirms no `console.*`/`DBG` payload output
in those non-test files and an explicit codec depth bound. Independent review
of the revised helpers remains in progress; these unit results are not browser
GREEN or final validation. The prior built Island chunk baseline is 59,763
bytes; the shared-schema bundle comparison is still pending.

The confirmation also needs acknowledgement reset when authority or target
changes. The bounded ActivationForm key repair is authorized using existing
party/type/version/expected-version/step-up fields; it introduces no new
authority prop. The mounted regression and local-expiry reset mechanism are
not yet verified.

Root's fresh pinned read-only runner enumeration exits 0: 18 tests in six
files (6 confirmation, 5 existing Slice 09, 4 preserved Slice 10, and 3
preserved Slice 12 checks). These later-slice regressions remain in scope for
validation of existing work, not permission to resume later implementation.

## React integration review — not yet frozen

The author subsequently reported a focused component run of 23 files / 149
tests passed, type checks, lint, web build and bundle checks. Root did not
accept that handoff as a final freeze: review found dropped loading, offline,
focus, announcement and rate-limit behavior in the replacement path. Those
requirements already exist in FE03; restoring them needs no new contract.
No Chrome acceptance or fresh full-validation result follows from that run.

The new path must update React state rather than replace its owned DOM. It
must also replace the actor/party and optional disclosure fields with the new
validated projection, immediately disable controls on context change, and
ignore an older in-flight result. Mounted tests must observe the actual
Workbench consumer, not only a pure projection helper. Timer expiry must
reset acknowledgement without erasing the user's draft inputs.

Independent read-only dependency review found no production caller of the
legacy canonical-refetch installer. Its real consumers remain the functional
network-resilience browser bridge, AC263 integration, two unit suites and a
barrel export. Legacy GREEN therefore does not prove the new React path.
Their focus, live announcement, denial, retry countdown, network recovery,
binding-header transport, reconnect/read-reason and coalescing assertions
must be transferred before any retirement is considered. No legacy removal
is authorized or claimed here.

Further review requires failure cleanup, disable-before-navigation (including
manual-fetch opaque redirects), repeated-429 deadline reset, ordinary-hint
coalescing and the existing file-size caps. The author is still implementing
those regressions. The unchanged six-check production-built Chrome rerun and
full `pnpm validate` remain pending.

The next author status reported 157 focused tests passing, followed by a test
support split and scheduler extraction. That is still not a frozen acceptance
handoff. Root's scheduler review found that an older epoch's completion could
release the newer read's in-flight flag and drain its queue, while the older
loading timer lacked an epoch/disposal guard. It also found that queuing a
React state update immediately before `location.assign` does not establish
that controls were removed before navigation. Exact sequence regressions and
corrections are required before the unchanged Chrome run proceeds.

The author refroze at 22:58 UTC after reporting 25 component files / 162
passing tests, clean type/lint checks, a fresh 22:58:39 UTC web build and a
passing bundle check. Root read-back confirms the guarded scheduler, the
`flushSync` navigation commit, removal of the test-only mutable navigation
override, and source files under their caps. The six-check Chrome spec remains
byte-identical (`8df7c7bd38ec9e4889833de251395a168c231115e93115298ab5a2bef7c332ea`).
These are a reported focused result and a source checkpoint, not yet Chrome
GREEN or full validation. Final independent source review and a separate
mounted feedback suite for focus and countdown transitions remain pending.

## Evidence retained

The six exact failure directories and `.last-run.json` were copied recoverably
to `/tmp/wejammin-ac250-red-5l0ssf`, outside Playwright's replaceable output directory.
Root read-back verified six traces, six screenshots and failed-run status.
These local temporary files are diagnostic artifacts, not publication provenance.

## Integration changes and ownership

- New spec: `tests/e2e/phase-02-slice-09-confirmation-disclosure-real-route.spec.ts`.
- Production runner registers it; the functional/dev runner explicitly ignores it.
- Assertions cover the five required clauses, inline heading focus and normal
  Tab flow, Escape/reset without a command, retained draft fields, fail-closed
  label/freshness states, and 320/768/1280 CSS-pixel reflow.
- The verified text must match `Verified until HH:MM UTC`; advancing the browser
  clock past ten minutes must return the display to required. This does not
  represent server MFA revocation or real-device zoom acceptance.
- QA owns the new spec and the two runner configs. A separate DeepSeek stream
  owns signed local fixture wiring. A third diagnoses browser failures together
  because CSP/hydration and event delivery may be related.

## Acceptance boundary

The unchanged six-check production-built Chrome run is now GREEN: start
23:06:20 UTC, exit 0, six passed in 20.2 seconds. Root verified retained
`/tmp/wejammin-ac250-green-q88dqI/.last-run.json` as passed with no failed IDs
and verified the spec's unchanged hash. Each check passed the existing strict
console/page-error/request-failure/no-command watcher. Browser-clock expiry
and Escape/draft retention now pass, with no CSP relaxation or console filter.

The independent final feedback suite is 3/3 GREEN at 23:04:47 UTC and records
actual focus retention, denied boundary focus, and 3→2→1→0 retry transitions
with same-value re-arm. Its final hash is
`6559583e77c3524187b110c2dc0c6e68dc552a20dadc22d6b60c85a50db8c311`.

This verifies AC250's local disclosure requirement; current-status tracking
is reconciled and fresh full validation passed as recorded below. Genuine
activation binding is not an additional AC250 requirement. Root
read-back of Phase 2 AC250 and FE03 confirms that it governs the displayed
consequence, scope, version, acting context and step-up, with modal behavior
conditional on inline being insufficient. Binding-bound MFA belongs to AC091
and the actual activation command belongs to AC225; both remain open.

The current production label resolver matches the server-derived acting party
to one authorized selectable identity-list item.
The registry freshness hint is derived from authenticated-session `stepUpAt`.
Neither the new local profile nor those presentation assertions alone prove
that the particular private binding required by the activation RPC is valid.
Current source read-back confirms `production-auth.ts` derives `mfaFresh` from
authenticated-session `stepUpAt` independently of optional `actingContextId`.
`auth_session_read` can return a safe self-party projection with a null private
binding when no binding selector is supplied. This is why a readable party
label and a fresh authentication hint cannot alone be promoted to binding proof.
This caveat limits what the disclosure evidence proves; it must not broaden
AC250's locked acceptance requirement into an activation-authority gate.
The trusted private binding transport fix does not create review/approval
producers. The pending amendment and the activation gates remain separate.

The pre-run count was 261/279 active. AC250 alone advances it to 262/279 after
the applied tracking reconciliation; all 17 activation criteria remain open,
Phase 2 stays 8/17 and Slices 10–17 do not resume. No actual activation,
hosted/provider, real-MFA or whole-slice closure is claimed.

## Fresh full-validation handoff

Two failed attempts are retained rather than represented as GREEN:

- Start 23:26:37 UTC, handle 23156, exit 1:
  `/tmp/wejammin-validate-20O7U5/validate.log`. Contracts, database type parity
  and progress checks passed; formatting reported 15 paths. Only those paths
  were formatted. The resulting oversized test was split without dropping
  assertions into `content-schema-registry-island-refetch-success.dom.test.tsx`
  (128 lines) and `content-schema-registry-island-refetch.dom.test.tsx`
  (340 lines). Production modules remain within their 300-line cap.
- Start 23:31:09 UTC, handle 31096, exit 1:
  `/tmp/wejammin-validate-moMNKz/validate.log`. Coverage passed, but Playwright
  discovered the Vitest-only `support/s09-disclosure-fixture.test.ts` and failed
  before browser execution. The functional config now narrowly excludes that
  unit file from Playwright discovery; it remains in Vitest coverage. The unit
  suite remained 9/9 GREEN, and discovery retained 105 functional and 18 real
  browser tests. No genuine browser test was excluded.

The fresh third run started **23:42:53 UTC**, handle **62175**, and completed
with actual **`VALIDATE_EXIT=0`** in
`/tmp/wejammin-validate-4StDhD/validate.log`, using Node 22.23.1 and pnpm 11.24.0.
Root independently read the terminal log, coverage summary, passed browser
metadata and performance result:

- Contracts, database type parity, progress, formatting, lint and types pass.
- Vitest: **789 files, 6,808 passed, one skipped**. All four configured coverage
  axes are 100%; this is the configured coverage scope, not every possible
  hosted or production workflow.
- Bounded Slice 09 evidence checks pass; intentionally unavailable
  hosted/platform cases remain skipped, not accepted.
- Chrome: **105 functional tests pass** and **18 production-built real-route
  tests pass**, including the unchanged six AC250 checks.
- Builds and bundle budgets pass; initial-route gzip is 77,924 bytes against
  the 92,160-byte budget.
- Local performance smoke passes: 20 samples, zero errors, p95 1.31 ms against
  the 500 ms threshold. It is not production SLO evidence.

No app source changed during the successful run. Subsequent handoff changes
are documentation only. The owner-pending activation producer amendment is
still unapproved; no deployment, account, grant, provider or PR was changed.

The final post-format focused component verification started 23:54:30 UTC,
handle 65970, and passed **27 files / 165 tests** with actual `COMP_EXIT=0` in
`/tmp/wejammin-comp-verify-c18rF3/component.log`. Root read the retained report
and rechecked the unchanged AC250 spec digest. The two additional files after
the earlier 25-file checkpoint are the success-test split and the independent
feedback regression suite; no assertion was removed to obtain GREEN.

## Source-link integrity follow-up

The next goal continuation found 282 broken Slice 09 specification citations:
17 architecture links, 200 BE03a links, 48 FE03 links and 17 engineering-standard
links pointed to pre-`wiki/specs` locations. All four replacement files exist.
The scoped repair changes only those verified link targets and preserves their
fragments, criterion wording, checkboxes and the 262/279 active count.

The new actual-filesystem source-link guard was RED at two failed/two passed
with 282 missing targets, then GREEN at four passed after repair. The final
new guard plus existing completion-policy/traceability suites pass 19/19 in
three files. Logs are retained at `/tmp/wejammin-ac250-links-z8raZE`.
Root independently found zero missing targets across all 315 local tracker
links. The guard proves file-target integrity, not rendered fragment behavior,
AC250 interaction behavior, activation authority or whole-slice acceptance.
Its final source hash is
`7e388d58ca0b7b7bc8f4ad9f64be65ca1506f10a63967a774f0a3c1cd7330988`.

The earlier full-validation pass predates this new test. The fresh serial
follow-up started **2026-10-02T00:13:16Z**, handle **20339**, and completed
with actual **`VALIDATE_EXIT=0`** in
`/tmp/wejammin-validate-qGKqtS/validate.log`. Node 22.23.1/pnpm 11.24.0:
**790 Vitest files, 6,812 passed plus one skip**, 100% configured coverage,
bounded evidence, **105 functional Chrome** and **18 production-built route**
tests, build, bundle budgets and local smoke all pass. The smoke has 20 samples,
zero errors and p95 1.32 ms. Root independently verified the terminal log,
coverage summary, passed browser metadata and unchanged guard source hash.
No validator remains live; no app/config source changed during the run.
The producer amendment is still awaiting owner approval; no continuation
implicitly approves it. Subsequent handoff edits are documentation only.
