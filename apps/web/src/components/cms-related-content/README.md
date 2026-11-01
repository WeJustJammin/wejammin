# CMS related content (Slice 12)

## Contents

The author's related-content surface (BE03c CMS-03C-05; FE03 `CmsRelatedContentForm`, :890, :1473,
:1601): the protected page `/app/cms-content-modeling/entries/:entryId/related-content` and its form.
An author pins entries in order (at most 32), excludes entries (at most 64) and chooses a derived rule
from the code-owned registry (`shared-terms`, `same-type-recent`) with a candidate bound of 1 to 128.
The page loader (`load-related-content-page.ts`, `related-content-page-reads.ts`) and the island live
together here; the Astro file under `pages/app/cms-content-modeling/entries/[entryId]/` only maps the
loader outcome to a response.

## Protected saved rule (DEC-195)

`cmsRelatedContentRead`, `GET /api/v1/cms/entries/{entryId}/related-content`, returns the active saved
rule or explicit `null`. It also gates edit authority: a visible source without edit authority returns
403; a concealed or absent source returns 404. The page reads draft detail first, saved rule second,
and readable candidates third. A failed or unverifiable read closes the page. DEC-195 resolves the
former SG-S12-03/04 read and edit-authority boundaries.

Stored pins and exclusions are kept exactly, including targets the viewer cannot currently open.
The saved derived rule names only `{ key, version }`; its `maxCandidates` is unknown, so the form asks
for that bound before saving a derived rule.

## Conflict review and explicit reapply

A 409 preserves all local lists, rule choices, bound and the original entry token, and refetches by itself
(FE03 1049, DEC-242): the review below starts without a press. Review changes remains to read again after a
failed or limited read. Another write needs a verified review first; ordinary Save and native form submission
cannot bypass that requirement.
`related-conflict-read.ts` reads protected draft detail FIRST and saved rule SECOND. Both are same-origin,
no-store GETs with no query, body or mutation/conditional headers. Each stage owns an 8-second abortable
deadline covering fetch, safe retry, body parsing and lazy contract validation. Unmount cancels the owned
signal; mounted/sequence checks suppress late answers, timers and the next GET even if fetch ignores abort.

Both strict schemas, requested-entry identity and strong ETag bindings must verify before the server
snapshot appears beside the untouched local fields. Reapply passes the reviewed non-null rule's `version`
directly to the request builder. An empty rule uses the EARLIER draft's `entry.version`, with no further
draft GET that might silently adopt an intervening rule. The first Reapply gets a fresh idempotency key;
an unchanged uncertain attempt retains its key under the existing transport policy. Another 409 requires
another review. Failed, malformed, canceled, 403 and 404 reads offer no Reapply. A 429 keeps the input and
gates Review changes for the verified wait. Discard is an explicit page reload.

## Unknown outcome and success refetch (FE03 1047, 1050)

An unknown outcome renders the pending label "Checking whether the save went through…" and is reconciled by the same
draft-then-rule read before any retry is offered (`related-reconcile.ts`, `use-related-outcomes.ts`). The saved rule is
the answer to the request only when its entry token is the sent version plus one and its pins, exclusions and derived rule
equal the request: then the save is shown as saved. A verified read that finds no such save says "Save not recorded" and
offers the identical retry under the same key. A read that cannot verify keeps Save off and offers Check again (a 429
blocks both for the stated wait). A verified success reads the saved rule once more and takes its entry token as the next
version; a refetch that cannot verify keeps the verified save.

## Ownership

These modules render server-verified data and send an exact request. They own the form state, the
explicit controls, the `Idempotency-Key` policy and the fixed copy. Authority, eligibility of every
target (exists, active, same owner, readable, not the source), the rule registry and `eligibleCount` are
the Worker's and the database's, reached through `apps/web/src/server/cms-composition-platform-related.ts`.
The protected saved-rule read gates edit access; each write rechecks authority and target eligibility.

## Module map

- Zero zod in the browser (FE03 AC261, `related-content-static-closure.test.ts`). `related-rules.ts` is
  the browser copy of `CMS_RELATED_RULES` (its test is the drift guard), `related-content-lists.ts` the
  pure pin and exclusion operations, `related-content-request.ts` the request builder,
  `related-content-submit.ts` the transport that verifies a 201 against its request, and
  `related-candidates.ts` the entry-list reader for "Load more". Canonical conflict reads load the existing
  strict validators lazily: draft validators use `cms-contract-validators`; the related-rule schema uses
  a dynamic contract import.
- Copy: `related-content-copy.ts` (including the one target-refusal message) and `related-status-copy.ts`.
- State: `use-related-content-form.ts` (with `use-related-list-edits.ts` for the pin and exclusion commands and
  `use-related-outcomes.ts` for the reconciling and success reads), `use-related-conflict-review.ts` and, for the
  picker's "Load more", `use-related-candidates.ts`. The
  candidate read follows the FE03 network and retry contract (`retryingSafeRead`: 250 ms and 750 ms on a
  retryable 502/503/504; a 429 waits for `Retry-After`, announces the wait and keeps the choices).
- Views: `CmsRelatedContentForm` over `CmsRelatedPinList`, `CmsRelatedExclusionList`,
  `CmsRelatedCandidates`, `CmsRelatedRuleFields`, `CmsRelatedEntryLabel`, `CmsRelatedConflictReview`
  (verified server state and explicit actions) and `CmsRelatedStatus` (the one focusable result region).

## Conventions

- Pins and exclusions are form state and never URL state: any query on the page is a 400.
- Pins are an ordered list with Move up and Move down on every row; there is no drag-only path.
- "Exclusions win" is stated beside the lists; choosing Exclude on a pinned entry removes its pin.
- Candidates are only the entries the caller can read (CMS-03B-13). A pin is offered only for an `active`
  entry; any listed entry can be excluded. The list has no title, so an entry is shown by id and facts.
- A refused target is ONE fixed message at the offending row that never says why. The row comes from the
  violation pointer (`/pins/{n}`, `/exclusions/{n}`); without a pointer the form shows the message once.
  The same-origin proxy relays the typed 422 (`related_target_ineligible`, `derived_rule_unknown`) with at
  most 16 bounded pointers, so the row mark comes from the real relay.
- No step-up: BE03c 216 lists recent MFA only for CMS-03C-07, -08 and -09, and the CMS-03C-05 catalog has
  no `STEP_UP_REQUIRED` row. A 401 here is sign-in.
- Focus stays on the control that was used; after a save or a refusal it moves to the named result
  heading. Components stay at most 200 lines and tests at most 400.

## Extension rules

A new rule goes in `related-rules.ts` only after it is in `CMS_RELATED_RULES`; the drift test fails
otherwise. A new `reasonCode` goes in `related-content-submit.ts` (`TYPED_REASONS`) and its copy in
`related-status-copy.ts`. Changes to canonical reads must preserve strict schema/identity/ETag binding,
ordered draft-then-rule reads, cancellation, reviewed-token CAS and local-draft retention. Add a failing
boundary test before implementation; the conflict and lifecycle suites drive the real component.

## Related links

- `../cms-taxonomy-designer/README.md` (the precedent transport and result region)
- `../../pages/app/cms-content-modeling/entries/[entryId]/README.md`
- `../../server/README.md` (the same-origin proxy)
- `.memory/wiki/specs/fe/03-cms-content-modeling.md`
- `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md` (CMS-03C-05, 1417)

"Check again" is one control for the whole unconfirmed episode (`CmsRelatedContentForm`): it stays mounted and
`aria-disabled` while its read runs, so keyboard focus survives; a verified outcome moves focus to the result heading, a
still unverified one keeps it on the control. An edit never lifts a save that is being (or could not be) reconciled
(`keepOnEdit`). The status type lives in `related-content-types.ts`, so the form hook, `use-related-list-edits.ts` and
`use-related-outcomes.ts` do not import each other.

The candidate page read (`fetchCandidatePage`) ends at the shared 8,000 ms browser deadline and answers `failed`, which keeps
the list shown and offers the read again (`CmsRelatedContentForm.candidates.test.tsx`).
`CmsRelatedContentForm.closing-words.test.tsx` pins "no-store and never optimistic" for the candidate read and the save.
