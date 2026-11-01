# Governed definition-review components (Slice 12)

## Contents

The browser surfaces of the definition review of templates, patterns and
vocabularies (BE03c CMS-03C-06, -07, -08, -10 and -11): the review queue, the
review detail and its island, the decision and reviewer-assignment forms, and the
bounded `CmsGovernedReviewPanel` (submit for review, with the version's review summary and a
link to the review itself) with its template and pattern page wrappers
`CmsGovernedTemplatePanel` and `CmsGovernedPatternPanel`, and the owner's
`CmsGovernedActivationForm` (CMS-03C-09: activate, schedule or retire a version,
DEC-190). CMS-03C-18 to -21 are internal and never modelled.

## Ownership

These modules render server-verified resources and send exact request bodies built
from them. They own the `Idempotency-Key`, the exactly-once guard, the
reconcile-before-retry rule, the step-up detour and the fixed copy. They own no
authorization and no persistence: authority, concealment and every typed refusal
come from the Worker through the first-party proxies in
`apps/web/src/server/cms-governed-review-platform-*.ts`.

## Module map

- Zero zod in the browser (FE03 AC261, proved by `apps/web/src/cms-island-static-closure.test.ts`):
  `governed-review-command-specs.ts` builds nothing from the contracts at runtime,
  `governed-review-command-transport.ts` verifies a commit structurally (status,
  strong ETag = quoted version, request identity) because the same-origin proxy has
  already parsed the strict resource, and `governed-review-reasons.ts` /
  `governed-review-labels.ts` write out the closed vocabularies (their tests are the
  drift guards against the generated contracts). The decision reason is the one
  lazily loaded schema (`withCmsValidators`), exactly as the editorial form.
- Engine: the shared Slice 11 command controller is reused (key policy, step-up
  draft, sync conflict). CMS-03C-07 and -08 are the 03b CMS-03B-06 and -18 contracts
  applied to a definition review (DEC-137), so `GovernedCommandSpec.classifyAs`
  selects the shared fixed copy; `governed-review-refusal.ts` classifies the two
  submission refusals the shared table cannot speak. `use-governed-review-command.ts`
  binds both to React and always names the draft by the governed operation.
- Reads: `governed-review-page-reads.ts` (the server seam), the loaders
  `load-governed-queue-page.ts` and `load-governed-detail-page.ts` (strict parse, one
  closed state per status), `governed-review-canonical-read.ts` (the island's no-store
  refetch), and `load-governed-subject-review.ts` (a definition page's own review: the
  owned queue searched, at most four pages, for the exact kind, key and version; any
  failure is "no summary", never a guess).
- Activation (CMS-03C-09): `governed-activation-command-spec.ts` is the browser spec
  (kept apart from `governed-review-command-specs.ts` so the two do not import each
  other; its committed shape exposes the review version after the command as
  `version`, the new strong ETag), `governed-activation-refusal.ts` the fixed copy of
  its tokens, `governed-activation-model.ts` the pure model (offered actions, words,
  local checks, the request), `use-governed-activation-form.ts` the state,
  `CmsGovernedActivationFields` and `CmsGovernedActivationConfirm` the view. The
  schedule time is resolved by the same Time authority module and resolver as
  `CmsEditorialScheduleForm` (lazy: fetched only once Schedule is chosen or restored).
  Nothing is sent before an explicit confirmation naming the consequence (Escape and
  Cancel withdraw it before the commit and do nothing while the command is in flight;
  changing any input withdraws it). While the command is pending the step stays
  mounted with focus on the same commit control, which keeps its label and is
  `aria-disabled` and `aria-busy`; after a commit the step is cleared only once the
  re-read review has focus on its summary heading, and after an unknown outcome focus
  moves to the frame's "Check the current state" control. The frame's pending words
  follow the submitted action, not the live choice. An activation reads "not
  published" and, when the answer's `supersededVersion` (DEC-191) is a number, ends
  "Version N is now superseded."; a first activation says nothing about one. A
  scheduled one reads "Scheduled, not active". `governed-activation-command-spec.ts`
  repeats the member's rule without zod (a positive integer or null, null unless the
  action is `activate`); `governed-activation-contract-drift.test.ts` proves it
  agrees with the generated schema.
- Views: `CmsGovernedReviewQueue` (server-rendered), `CmsGovernedReviewDetail` (with `CmsGovernedDecisionList`). The
  detail shows the review's most recent scheduled activation (DEC-191
  `activationSchedule`) as one line under the status: its state and, for a blocked
  or cancelled one, the fixed sentence of its closed `reasonCode` (FE03 :1118). The
  tables live in `governed-review-labels.ts`; `governed-review-canonical-read.ts`
  degrades the page for a schedule it cannot word.
- Forms: `CmsGovernedDecisionForm`, `CmsGovernedActivationForm`, `CmsGovernedAssignmentForm` over
  `CmsGovernedAssignmentCreate` and `CmsGovernedAssignmentRevoke`. Each form stays
  mounted for the life of its island and draws its frame while the server permits the
  action or its command still needs reading (`governed-review-form-visibility.ts`),
  so the sentence of a refusal survives the re-read that removed the action.
- Islands: `CmsGovernedReviewDetailIsland` (one persistent status line),
  `CmsGovernedTemplatePanel` and `CmsGovernedPatternPanel`. A server action control
  (revoke, assign, decide, submit) renders only while the server permits it.
- `*.test-support.ts` here, and `apps/web/src/server/cms-governed-review-fixtures.test-support.ts`,
  hold fixtures parsed through the real contracts.

## Loading strategy (FE03 budgets: island 35 KB, route 90 KB)

A command form is its own chunk, and it loads on intent. `governed-review-form-views.ts` (decision,
assignment, activation) and `governed-panel-form-views.ts` (the panels' submit form) resolve each form
with `loadViewOnIntent` (`../cms-editorial-workflow/cms-lazy-view.tsx`): eager on the server and under
Vitest, so the served HTML is complete; in the browser a `React.lazy` chunk that waits for the first
sign of intent in the form's region (`../cms-editorial-workflow/cms-lazy-intent.ts`): never scroll,
time or viewport size. Each form's command frame names its region
(`lazyRegion="governed-decision"` and so on), the controls stay native and enabled until the form
has hydrated, what was typed or chosen is carried into the form's state, and a submit pressed
before then is held and replayed once. The assignment form's reviewer read waits for the same
intent. A
reviewer offered every action would otherwise fetch the three forms and the command machinery with
the page (103 KB against the 90 KB route budget). `WhenOffered` mounts a form the first time the
server offers its action and keeps it. What a mounted form needs only after a send (the transport and
the refusal classifiers, `governed-answer-machinery.ts`) or after a refetch (the canonical read) loads
then. Paths (`governed-review-routes.ts`) and lifecycle copy (`governed-state-labels.ts`) are tiny
modules so a panel never loads the review view or the whole copy table.
`src/cms-lazy-forms-closure*.test.ts` names the module that drags the command machinery back into an
island's static closure, and checks that every form that loads on intent names the region its views
module declares; `pnpm bundle:check` proves the bytes.

## Extension rules

A new governed command gets its row in `governed-review-command-specs.ts` (or, like
activation, its own spec file built on that file's helpers), its
reason list in `governed-review-reasons.ts` (the parity test fails until it equals
the contract), a proxy case in `server/cms-governed-review-platform-command.ts`, and
a form that reads `permittedNextActions`, never the capability, loaded through a `*-form-views.ts` module. A new subject kind
adds its label to `governed-review-labels.ts` and a wrapper like
`CmsGovernedTemplatePanel`. Components stay at most 200 lines; no business rule
lives in a component.

## Conventions

A degraded review detail is never kept (FE03 1050): `CmsGovernedReviewDegraded` shows only that the review is not
shown and when it was last verified, the stale assignment list is not shown, and the review stays hidden with every
commit control disabled until a read VERIFIES, including while a re-read is in flight (the island derives `unverified`
during render). A non-429 degrade offers "Read the review again", which stays mounted (`aria-disabled`, same label) while the read runs so
keyboard focus survives; a verified read the person started moves focus to the summary heading and announces "The review
was read again." (`use-governed-reread.ts`). A 429 offers none, because Retry-After governs and the automatic read
follows it and moves no focus. `reviewer_not_eligible` keeps its one uniform sentence at the reviewer field and, like every
409 reason, refetches the review (`governed-review-refusal.ts`, DEC-242). A verified success clears the form's draft (decision, assignment, activation; activation
only after the summary heading took focus), but only the fields that still hold what was sent: a value typed while the
command ran is kept (`use-governed-sent-draft.ts`). The queue's degraded cell is settled by DEC-242: a closed notice
with Retry, nothing from an earlier read (FE03 1050 amended).

No person, actor, party or lineage identifier in text, URL, storage or logs; the
chosen reviewer id is island-local and is discarded on a step-up navigation. A
scheduled version reads "Scheduled, not active". A decision reason, the policy basis
and every assignment identifier are server-derived and never enter a URL or cache.

The canonical review read (`governed-review-canonical-read.ts`) ends at the shared 8,000 ms browser deadline and answers
`degraded`. A 200 queue page that is not the strict page is a degraded read like any other: the closed notice offers Retry at
the same list position (`load-governed-queue-page.ts`). `CmsGovernedReview.closing-words.test.tsx` pins "no-store and
never optimistic" for the submit command and the review read; `governed-review-page-mounts.test.tsx` drives the chain each
template and pattern page runs and mounts the panel it renders (P2-S12-AC-069).

## Related links

- `apps/web/src/components/cms-editorial-workflow/README.md`
- `apps/web/src/pages/app/cms-content-modeling/definition-reviews/README.md`
- `apps/web/src/pages/api/v1/cms/governed-reviews/README.md`
- `.memory/wiki/specs/fe/03-cms-content-modeling.md` (CMS-03C-06 to CMS-03C-11)
