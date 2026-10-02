# CMS composition browser components

## Contents

`CmsTemplateDesigner.tsx` is the bounded CMS-11 React island for defining a
private template draft. `cms-template-designer-request.ts` turns form fields
and the protected selector projection into a strict `TemplateVersionRequest`.
`cms-template-designer-submit.ts` sends a first-party, same-origin POST and
accepts only a validated `201` draft resource with its matching ETag.
Colocated tests cover the request builder, transport, server-rendered form,
and uncertain network retry.

`CmsTemplateEditDesigner.tsx` prefills a successor form from the protected
latest detail, keeps the template key immutable, and sends exact version CAS.
Its local edit state lives in `cms-template-edit-reconcile-state.ts` (the
`useCmsTemplateEditState` hook, which owns draft fields, status, and the
unchanged-body idempotency attempt) and the render-only latest-version
comparison panel lives in `CmsTemplateLatestVersionPanel.tsx`.
`cms-template-edit-reconcile.ts` rechecks the canonical no-store detail after
conflict or uncertain outcome. The user can compare complete values and
explicitly rebase without losing local edits; a new idempotency key is used
only after the parent version or request body changes.

The island is split by concern: `CmsTemplateFields.tsx` renders keys, scoped
content-type choices, locale, audience, and reserved regions;
`CmsTemplateSlots.tsx` and `CmsTemplateBindings.tsx` render bounded repeatable
manifests; `CmsTemplateStatus.tsx` renders focusable outcome feedback.
`cms-template-designer-form-types.ts` holds only the editable row shapes.

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

Use semantic fieldsets and persistent labels for editable manifests. Keep
status and conflict messages in a focusable live region; report private draft
creation separately from activation or publication. Tests use shared contract
fixtures and a jsdom interaction run for unchanged-body idempotent retry.

## Related links

- `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md`
- `.memory/wiki/specs/fe/03-cms-content-modeling.md`
- `.memory/pipeline/progress/slices/phase-02-slice-12.md`
