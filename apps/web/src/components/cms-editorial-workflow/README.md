# CMS editorial workflow components (Slice 11)

## Contents

The browser surfaces of the review, schedule, preview and publication workflow
(CMS-03B-05 to -09 and the reads and assignment CMS-03B-15 to -18): the workflow
panel and its checks, the reviewer queue, the review detail, and the six command
forms with the engine they share. Internal operations CMS-03B-19 and -20 have no
browser surface and are never modelled here.

## Ownership

These modules render server-verified resources and send the generated, strict
request bodies. They own the `Idempotency-Key`, the exactly-once guard, the
reconcile-before-retry rule, the step-up detour and the fixed copy. They own no
authorization, no time rules (the pinned Time authority is imported, never
re-implemented) and no persistence: authority, concealment and every typed
refusal come from the Worker through the first-party proxies in
`apps/web/src/server/cms-workflow-platform-*.ts`.

## Module map

- Lazy contracts (AC-106): the island and its forms ship no zod. The specs table
  is zod-free (`schemas(validators)` reads the generated schemas from the lazily
  loaded validators); the transport, the canonical reads and the form checks
  obtain them with `loadedCmsValidators() ?? (await loadCmsValidators())` or
  `withCmsValidators`, and a command frame warms them when a control takes
  focus. Validators that cannot be fetched send nothing and say so
  (`validators_unavailable`).
- Contracts and transport: `cms-workflow-command-specs.ts` (the six commands as
  one table shared with the proxy), `cms-workflow-command-transport.ts` (send one
  command, reduce the answer to one closed result), `cms-workflow-canonical-read.ts`
  (the no-store refetch of a workflow or review: a declared-retryable 502/503/504 is retried
  twice, a 429 is a `degraded` result with a `rateLimit` member; FE03 :1172-1173),
  `cms-workflow-reviewer-options.ts` (the owner's reviewer list, same retry; a 429 is
  `unavailable` with `rateLimit`).
- State: `cms-workflow-command-controller.ts` (key policy, step-up draft and
  restore, sync conflict), `use-cms-workflow-command.ts`,
  `use-cms-workflow-canonical.ts` (after a 429 it keeps the last verified resource, exposes
  `rateLimit` and reads once more when the stated wait has elapsed, five seconds when none was
  stated; `CmsWorkflowRateLimitNotice` announces it politely), `use-reviewer-options.ts`
  (the same wait-then-read for the assignment form), `use-cms-workflow-draft-fields.ts`.
- Copy: `cms-workflow-labels.ts` (every closed vocabulary), `cms-workflow-refusal.ts`
  (a refusal to a kind, a sentence and the fields it names).
- Reads (server-rendered): `CmsEditorialWorkflowPanel`, `CmsEditorialPreflightSummary`,
  `CmsEditorialReviewQueue`, `CmsEditorialReviewDetail`.
- Forms: `CmsEditorialReviewSubmitForm` (05), `CmsEditorialDecisionForm` (06),
  `CmsEditorialScheduleForm` (07, lazy Time authority via `use-cms-schedule-time.ts`
  and `cms-workflow-schedule-resolution.ts`; its action choices come from
  `cms-workflow-schedule-actions.ts` and the server-proven `publishPermitted`),
  `CmsEditorialPreviewForm` and
  `CmsEditorialPreviewToken` (08), `CmsEditorialPublishConfirmation` (09),
  `CmsEditorialReviewAssignmentForm` over `CmsEditorialAssignmentCreate` and
  `CmsEditorialAssignmentRevoke` (18). Shared parts: `CmsWorkflowCommandFrame`,
  `CmsWorkflowFields`, `CmsWorkflowClosedState`.
- Islands: `CmsEditorialWorkflowIsland` and `CmsEditorialReviewDetailIsland`. Each
  owns one persistent confirmation line (`CmsWorkflowStatusRegion`, fed by
  `useIslandConfirmation` and read by the forms through `useCommittedAnnouncement`,
  both in `use-cms-workflow-status.ts`); `CmsWorkflowRefusalAlert` is the alert a
  form frame renders for a refusal, an unavailable step-up or an ended session.
- `*.test-support.ts(x)` — fixtures parsed through the real contracts
  (`cms-workflow-fixtures`), the island mounts (`cms-workflow-island-mount`) and
  the focus drivers (`cms-workflow-focus`, `cms-workflow-focus-harness`).

## Extension rules

A new command is a row in `cms-workflow-command-specs.ts` (and its registry row),
a form over `useWorkflowCommand` and `CmsWorkflowCommandFrame`, and its copy in
`cms-workflow-labels.ts` / `cms-workflow-refusal.ts`. Never render server text:
only a verified reason token selects a fixed sentence. Never persist a manifest,
a version set, a hash, a token or a person identifier: a step-up draft holds only
the editable text fields of a form. A 202 is "scheduled" or "recorded", never
"published". Files stay within the size limits (components 200 lines, lib 300,
tests 400).

A lazy chunk is not a deferred one. Chrome (`phase-02-slice-11-bundle-budget-real-route.spec.ts`,
P2-S11-AC-106) charges a route for every script a cold load fetches until idle, so a form that an
island mounts at hydration is part of the cold load whether it is a dynamic import or not.
`pnpm bundle:check` charges the same: the static closure of the island, the shell and the runtimes
PLUS every dynamic edge of that closure that is not listed in `CMS_ON_DEMAND_CHUNKS`
(`scripts/verify-bundle-budget.mjs`), followed transitively. Three ways keep a route under its
90 KB:

- A form the route always mounts for a permitted reader is part of the island's static graph
  (`cms-workflow-form-views.ts`: the entry workflow island's four forms). The schedule form must be
  there before its disclosure opens, because opening it may fetch only the Time authority and the
  contract schemas (80 KB lazy-chunk threshold, the third test of the Chrome spec).
- What a mounted form needs only after something happens loads then, and is listed in
  `CMS_ON_DEMAND_CHUNKS` with its reason: the transport and the refusal classifier after a send
  (`cms-workflow-answer-machinery.ts`; a focused form warms them, like the validators), the
  canonical read of an island on its first refetch, the Time authority when the schedule form opens.
- A form that is not needed to read the page loads on intent (`cms-lazy-view.tsx` `loadViewOnIntent`,
  `cms-lazy-intent.ts`): the governed review detail forms and the governed panel submit form. The
  command frame names the form's region (`lazyRegion`), the server markup carries it, and the
  chunk loads on the first pointer over, press, touch, focus or key inside the region, or a change of
  one of its controls: never on scroll, time, visibility or viewport size, so a region in the first
  viewport waits too and the gate's exemption is true. Until the form hydrates its controls are
  native and enabled. What was typed or chosen stays in the DOM, but React reports no change for
  it, so the module records the last value of every control of an unhydrated region and the field
  primitives start their state from it when they mount (`takePreHydrationValue`,
  `useSeedFromPreHydration` in `CmsWorkflowFields.tsx`): nothing is dropped and nothing is
  disabled. A submit before then is cancelled, arms the region and is replayed once with
  `requestSubmit` after the seeded state rendered (a test fails if the replay is not deduplicated).
  A click on a `type="button"` action before hydration is not replayed; the region arms on the
  pointer's first move, so on a mouse the chunk is normally there before the press.
- A read a mounted form makes for itself (the reviewer choices of an assignment form) waits for the
  same intent (`use-reviewer-options.ts`, `whenRegionTouched`), because that read fetches the contract
  validators and a mount effect would put them into the cold load (V11 H2; FE03 "lazy modules
  load on explicit entry").
- Every lazily loaded view sits in a retry boundary (`cms-retryable-lazy.tsx`): a chunk that cannot be
  fetched leaves an alert and a button that imports it again, and the rest of the page stays usable.
  Every dynamic import that happens on an action goes through `lib/module-unavailable.ts`
  (`importModule`) or an importer seam a test replaces, and a rejection is never remembered.
  A browser, unlike jsdom, keeps a FAILED dynamic import in its module map (re-importing the same
  URL rejects without a request), so every such import is wrapped in `retryable`
  (`lib/retryable-import.ts`): the retry imports the failed URL with a `wj_retry` marker. The
  gate's meta test fails on a call site that is not wrapped; the real-Chrome proof is the harness
  in the lane report and the governed real-route spec T5.
- The result a committed command leaves for the editor page (reader and panel) is part of the
  editor island: that page shows it without the person doing anything, so the gate charges the route
  for it as a landing, not as an exemption.

A new form or heavy module goes through `src/cms-lazy-forms-closure*.test.ts` (closure guards) and
`tests/performance/cms-editorial-bundle-budget-mounted.test.ts` (the gate, with a fixture route).

Tests that send a command or refetch call `preloadWorkflowAnswerMachinery`
(`cms-workflow-answer-machinery.test-support.ts`) first, so the step under test does not race the
first load of a module.

## Focus rules (FE03)

Focus stays on the control a person activated until navigation or a named result
heading; a refetch never moves it. Only these may take it: the refusal alert and
the local-error summary of `CmsWorkflowCommandFrame`, the preview token heading
of `CmsEditorialPreviewForm`, and the heading a form names to its island through
`onDone` (`WORKFLOW_HEADING_IDS`, `REVIEW_DETAIL_HEADING_IDS`) once the canonical
read behind the command has landed. A commit control is `aria-disabled`, never
`disabled`, because a disabled button drops keyboard focus to the body. The rules
are pinned per form by `cms-workflow-focus-forms.test.tsx` (every command form)
and through the real islands by `*Island.focus.test.tsx`; the route heading on
navigation only is `apps/web/src/lib/route-heading-focus.ts`.

## Confirmations (FE03 "announce status")

A committed command is confirmed by one polite atomic status line that the
island owns (`data-cms-workflow-status="island"`, under the Actions heading),
never by the form that sent it: the canonical refetch that follows a decision, a
submission, a publication or a schedule removes that form within a few
milliseconds, and a confirmation inside it would be gone before assistive
technology could read it. The line is mounted empty with the island, so it is
registered before the first message. A committed form hands its sentence to the
line and its own status line then stays empty, so exactly one live region says
it. The sentence stays until the next command begins (any form in the island
reaching `pending`), until the form that produced it starts over (`startOver`: hiding
a preview token, assigning another reviewer) or until navigation. A refusal, a lost
answer and a step-up detour put nothing in the line: the pending, restored and
unknown sentences stay in the form's own status line and a refusal in its alert. When the island ends
(session over, record gone) the line goes with the protected data. A form mounted
alone, outside an island, keeps its committed sentence in its own line. Focus is
unaffected: the line never takes it. Pinned by `*Island.status.test.tsx` (through the
real islands and the real controller) and `use-cms-workflow-status.test.tsx`.

## Schedule actions

BE03b:268-270 refuses the revision author only the action `publish`. The island
passes `publishPermitted={permittedNextActions.includes('publish')}` and the form
then offers `unpublish`, `expire` and `archive` (defaulting to the first) with the
fixed second-person note; it never hides the form. A stored or earlier `publish`
choice is replaced by the default once `publish` is no longer offered.

## Retain input (FE03, AC-037, AC-040, AC-043)

A refusal or a lost answer never costs a person what they typed. The forms keep the entries in their own
state (`use-cms-workflow-draft-fields.ts`, or the preview form's `useState`), never in the controller, so the
controller specs cannot prove retention. `cms-workflow-input-retention.test.tsx` (decision, submit, preview)
and `cms-workflow-input-retention-time.test.tsx` (schedule, publish) mount each form with real fetches, enter
values, drive a definite 409 or 422 and an unknown 504, assert the controls still hold exactly what was
entered, press the commit control again and assert the second request carries the same body (and, after an
unknown outcome, the same `Idempotency-Key`). Their shared fetch queue, environment and request readers are
in `cms-workflow-input-retention.test-support.ts`. To cover a new form add a `describe` to the file with room
(each stays under 400 lines) and assert the entered values, not a phase.

## Conventions

Island tests use `// @vitest-environment jsdom` with the native-DOM driver in
`../cms-editorial-fields/cms-editor-dom.test-support.tsx`. Element ids repeat
across mounts, so a test that mounts two forms unmounts the first. Assertions
prefer roles, accessible names and live-region attributes over styling.

## Related links

- `.memory/wiki/specs/fe/03-cms-content-modeling.md` (Slice 11 surfaces and states)
- `.memory/wiki/specs/be/03b-editorial-workflow-publication.md`
- `apps/web/src/components/cms-editorial/README.md`
- `apps/web/src/server/README.md`
