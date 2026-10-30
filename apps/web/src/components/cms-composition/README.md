# CMS composition browser components

## Contents

`CmsTemplateDesigner.tsx` is the bounded CMS-11 React island for defining a
private template draft. `cms-template-designer-request.ts` turns form fields
and the protected selector projection into a strict `TemplateVersionRequest`.
`cms-template-designer-submit.ts` sends a first-party, same-origin POST and
accepts only a validated `201` draft resource with its matching ETag.
Colocated tests cover the request builder, transport, server-rendered form,
and uncertain network retry.

`cms-template-unavailable-copy.ts` holds the fixed sentence of the edit page's "Designer unavailable" region by read
status (`pages/app/cms-content-modeling/templates/[templateKey].astro`).

`CmsTemplateEditDesigner.tsx` prefills a successor form from the protected
latest detail, keeps the template key immutable, and sends exact version CAS.
Its local edit state lives in `cms-template-edit-reconcile-state.ts` (the
`useCmsTemplateEditState` hook, which owns draft fields and status) and the render-only latest-version
comparison panel lives in `CmsTemplateLatestVersionPanel.tsx`.
`cms-template-edit-reconcile.ts` rechecks the canonical no-store detail after
conflict or uncertain outcome. The user can compare complete values and
explicitly rebase without losing local edits; a new idempotency key is used
only after a verified resolution permits a different request or an explicit
rebase selects a verified newer parent.

`use-template-unknown-attempt.ts` owns an immutable request/body/key/base
snapshot and a synchronous admission guard, set before lazy validation. A lost
response blocks every submit path, including native form events, until the
manual canonical read verifies the original attempt's parent. Failed or
unverifiable reads and elapsed rate waits cannot resolve that uncertainty.
Verified not-saved permits unchanged-body replay with its original key; a
verified newer parent still requires explicit rebase. Local edits remain
editable and are never overwritten by pending requests or reconciliation.
Scope generations ignore obsolete validation, POST, and read completions after
unmount or detail changes; the existing safe-read retry and rate-wait cleanup
remain in their original helpers.

Only the commit action is disabled during preparation and POST; it exposes
pending text. The latest-read and reviewer 429 notices retain an initially
empty polite node and update its text after commit, including a mount that
already has a limited result. Other latest-read failures remain alerts.

The island is split by concern: `CmsTemplateFields.tsx` renders keys, scoped
content-type choices, locale, audience, and reserved regions;
`CmsTemplateSlots.tsx` and `CmsTemplateBindings.tsx` render bounded repeatable
manifests; `CmsTemplateStatus.tsx` renders focusable outcome feedback: a verified success is the named result heading `h3#cms-template-result-heading` (focused through `cms-template-result-focus.ts`, shared with the successor designer; a refusal or notice focuses the summary region instead).
`cms-template-designer-form-types.ts` holds only the editable row shapes.
A content type the edited version names but the protected selector no longer
offers (`cmsTemplateUnavailableTypeIds`) stays listed in `CmsTemplateFields.tsx`
as a checked, labelled "no longer available" box, so a successor can clear it
and be saved instead of dead-ending on a reload that cannot help.

## Unsaved changes (FE03 "Unsaved changes")

Both designers render inside `CmsTemplateLeaveGuard.tsx`, which wraps the shared
`useCmsEditorialLeaveGuard` hook: while the form holds values that differ from
the preimage the server last confirmed (`cms-template-draft-dirty.ts`: an empty
form for a new key, the parent version the successor was rebased onto) `beforeunload` is armed
and a click on any link of the page, including the header navigation outside the
island (the capture listens on the document), opens the inline
`CmsTemplateLeaveConfirm` instead of leaving ("Keep editing" takes focus and
returns it to the link, "Leave without saving" is the only exit). A verified
`201` (or "Start another draft") makes the form clean again and disarms the
guard, except for a value typed while the save was pending: FE03 1048 keeps the
fields editable then, that value was not sent, so the guard stays armed, the
value stays in the form and `CmsTemplateLateEditNotice` says it is not part of
the saved draft (`use-cms-template-sent-fields.ts` holds what the last submit
sent). The create designer's field state lives in
`use-cms-template-draft-fields.ts`. There is no autosave and no browser storage:
the scoped draft is the island's own state.

## Lazy validators

Both islands ship no zod (FE03 performance budgets, AC261): their static import
graph has no value import of `@wejammin/contracts`. The request builders and the
submit transport take the schemas as a `validators` parameter;
`use-cms-template-validators.ts` obtains them for a submit (already loaded after
the form received focus, else loaded on demand, one cold submit at a time).
If they cannot be fetched the draft is unchecked: nothing is sent and the
status shows `CMS_TEMPLATE_CHECK_UNAVAILABLE_MESSAGE`. The latest-version read
loads them itself and is `unavailable` if they cannot be fetched.

## Ownership

The Astro page at
`apps/web/src/pages/app/cms-content-modeling/templates/new.astro` obtains
`TemplateDesignerContext` through the protected Worker-backed read before
hydrating this island. No form is rendered on denied or degraded context. The
browser holds only scoped selectors and unsent form values; the Worker and
database remain authoritative for capability, ownership, compatibility,
versioning, and audit effects.

The create form always sends `expectedVersion: null` and no `If-Match`; the
successor form uses the canonical `expectedVersion` and matching strong
`If-Match`. Success is a **private draft**, never publication. An uncertain
network result retains the form and idempotency key for the unchanged body;
a conflict is not silently retried. The pages are no-store and do not cache
the protected projections offline.

## Extension rules

Keep slot and binding fields within shared Zod limits. Do not add unapproved
blocks, synthesize authority or publication evidence, or expose service
credentials in browser props. Local edit/reconciliation tests are not a
genuine authenticated two-request HTTP conflict or hosted acceptance proof.

## Conventions

A 403 renders the shared `CmsEditorialCapabilityGate`; a 422 `key_reserved` renders its fixed copy at the template key
field (`templateKeyError`); a successful successor names the parent version it was based on; the successor's latest
comparison is kept while a re-read runs or fails.

Use semantic fieldsets and persistent labels for editable manifests. Keep
status and conflict messages in a focusable live region; report private draft
creation separately from activation or publication. Tests use shared contract
fixtures and a jsdom interaction run for unchanged-body idempotent retry.

## Related links

- `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md`
- `.memory/wiki/specs/fe/03-cms-content-modeling.md`
- `.memory/pipeline/progress/slices/phase-02-slice-12.md`
