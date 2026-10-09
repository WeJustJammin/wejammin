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

- Contracts and transport: `cms-workflow-command-specs.ts` (the six commands as
  one table shared with the proxy), `cms-workflow-command-transport.ts` (send one
  command, reduce the answer to one closed result), `cms-workflow-canonical-read.ts`
  (the no-store refetch of a workflow or review).
- State: `cms-workflow-command-controller.ts` (key policy, step-up draft and
  restore, sync conflict), `use-cms-workflow-command.ts`,
  `use-cms-workflow-canonical.ts`, `use-cms-workflow-draft-fields.ts`.
- Copy: `cms-workflow-labels.ts` (every closed vocabulary), `cms-workflow-refusal.ts`
  (a refusal to a kind, a sentence and the fields it names).
- Reads (server-rendered): `CmsEditorialWorkflowPanel`, `CmsEditorialPreflightSummary`,
  `CmsEditorialReviewQueue`, `CmsEditorialReviewDetail`.
- Forms: `CmsEditorialReviewSubmitForm` (05), `CmsEditorialDecisionForm` (06),
  `CmsEditorialScheduleForm` (07, lazy Time authority via `use-cms-schedule-time.ts`
  and `cms-workflow-schedule-resolution.ts`), `CmsEditorialPreviewForm` and
  `CmsEditorialPreviewToken` (08), `CmsEditorialPublishConfirmation` (09),
  `CmsEditorialReviewAssignmentForm` over `CmsEditorialAssignmentCreate` and
  `CmsEditorialAssignmentRevoke` (18). Shared parts: `CmsWorkflowCommandFrame`,
  `CmsWorkflowFields`, `CmsWorkflowClosedState`.
- Islands: `CmsEditorialWorkflowIsland` and `CmsEditorialReviewDetailIsland`.
- `*.test-support.ts` — fixtures parsed through the real contracts.

## Extension rules

A new command is a row in `cms-workflow-command-specs.ts` (and its registry row),
a form over `useWorkflowCommand` and `CmsWorkflowCommandFrame`, and its copy in
`cms-workflow-labels.ts` / `cms-workflow-refusal.ts`. Never render server text:
only a verified reason token selects a fixed sentence. Never persist a manifest,
a version set, a hash, a token or a person identifier: a step-up draft holds only
the editable text fields of a form. A 202 is "scheduled" or "recorded", never
"published". Files stay within the size limits (components 200 lines, lib 300,
tests 400).

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
