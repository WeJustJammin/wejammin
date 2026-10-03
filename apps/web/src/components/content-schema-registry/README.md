# Content schema registry components

## Contents

Server-backed CMS workbenches, activation and command forms, typed status and
conflict surfaces, invalidation state, and their Slice 09 interaction tests.

## Ownership

These components own presentation and bounded interaction state for the content
schema registry. Authorization, release evidence, persistence, and lifecycle
decisions remain in the worker/API and database contracts.

The private `PLATFORM_API` read boundary emits only the allowlisted CMS read and
designer capabilities after server authentication. The Astro context consumes
that proof; missing capability metadata fails closed, and components never infer
authority from browser headers or query parameters.

## Module map

- `ContentSchemaRegistryCommandForm.tsx` — command shell and transport fields.
- `ContentSchemaRegistryFormFields.tsx` — reusable JSON, text, select, and
  checkbox controls re-exported by the command shell.
- `ContentSchemaRegistryInteractions.tsx` — compatibility barrel for the
  action bar, capability, confirmation, offline, and conflict surfaces.
- `ContentSchemaRegistryActionBar.tsx` — native command controls.
- `ContentSchemaRegistryCapabilityGate.tsx` — server-authoritative capability
  presentation.
- `ContentSchemaRegistryConfirmationStep.tsx` — activation confirmation and
  step-up state.
- `ContentSchemaRegistryOfflineStatus.tsx` — truthful connectivity status.
- `ContentSchemaRegistrySyncConflict.tsx` — explicit conflict outcomes.
- `ContentSchemaRegistryStatus.tsx` and
  `content-schema-registry-status-helpers.ts` — accessible status, retry, and
  HTTP error presentation.
- `ContentSchemaRegistryWorkbenchIsland.tsx` — serializable hydrated boundary;
  owns canonical refresh, loading/offline/status, and focus through React state
  so the protected subtree keeps React event ownership across refreshes.
  The island carries safe display context only (FE03 island invariant): no
  actor, person, party, binding, session or correlation identifier in any
  spelling. The server keeps the authority tuple; a trusted acting-context
  change bumps a browser-owned `contextEpoch` that resets local confirmation.
- `use-content-schema-registry-island-runtime.ts` — the island's effects:
  scheduler, projection state, focus restoration, command enhancement, and the
  online/offline/acting-context subscriptions.
- `ContentSchemaRegistryVersionCommands.tsx` — the designer's command stack for
  one version. Forms for CMS-03A-09/10/11/04 (`ContentSchemaRegistryVersionForms.tsx`,
  `ContentSchemaRegistryActivationForm.tsx`) render only when the server's
  `activationPreparation.permittedNextActions` allow them and the prefilled
  ids exist; `content-schema-registry-version-actions.ts` is that pure mapping
  (sealed passed dry run, approved review's approve-decision ids as one hidden
  JSON value). Nothing is typed as an id.
- `ContentSchemaRegistryActivationPreparation.tsx` and
  `content-schema-registry-dry-run-polling.ts` — dry-run/job status region and
  bounded polling that reuses the FE00 job polling hook; a job state alone never
  reads as a passed dry run.
- `ContentSchemaRegistryReviewMode.tsx`, `ContentSchemaRegistryReviewPanel.tsx`,
  `ContentSchemaRegistryReviewFacts.tsx`,
  `ContentSchemaRegistryReviewDecisionForm.tsx` and
  `ContentSchemaRegistryReviewAssignmentForm.tsx` — protected review surface
  (CMS-03A-13/12/14), including the `schemaReviewAssigned` reviewer variant.
  `ContentSchemaRegistryReviewAssignments.tsx` lists the owner-only
  `assignments[]` safe summary (display label and window, never a person id)
  with one revoke form per active assignment (CMS-03A-14 `revoke`).
  A 401 `STEP_UP_REQUIRED` routes to `/step-up?returnTo=<relative path>`.
- `content-schema-registry-canonical-refresh-scheduler.ts` — bounded
  one-in-flight refresh: metadata bursts coalesce to a single protected GET, a
  context change forces an immediate read, and the epoch guard discards stale
  completions. The Island commits the disabled projection before navigating.
- `content-schema-registry-canonical-read.ts` — maps one canonical read
  (success, degraded, denial, opaque/browser redirect, network failure) into a
  React-ownable outcome without touching the DOM.
- `content-schema-registry-canonical-state-validate.ts` — exact per-status
  structural validation of the refetched projection; unknown keys, unsupported
  reason variants, and malformed payloads fail closed. Reuses the shared public
  team zod list/detail aggregates.
- `content-schema-registry-canonical-projection-state.ts` — React-ownable
  projection state and its apply/fail-closed transitions.
- `content-schema-registry-canonical-keys.ts` — typechecked keyset of the
  accepted serialized island props (compile-time drift guard).
- `content-schema-registry-island-props-scanner.ts` and
  `content-schema-registry-island-props-codec.ts` — bounded, comment/raw-text
  aware scanner plus devalue-tuple decoder for the refetch response, with no
  second-document parse.
- `content-schema-registry-runtime.ts` — bounded read/mutation retry and
  canonical reconciliation contracts.
- `content-schema-registry-runtime-dom-mutations.ts` and
  `content-schema-registry-runtime-dom-feedback.ts` — progressive native-form
  enhancement, field-linked validation, conflict, auth, rate-limit, and
  degraded recovery feedback.
- `content-schema-registry-runtime-dom-refetch.ts` — one canonical protected
  GET per invalidation/reconnect, delayed loading, live announcements, safe
  replacement, and focus preservation.
  This is the legacy imperative DOM path retained for standalone compatibility
  consumers; it is not the React Island path above. The barrel and its
  colocated tests still exercise it, and it must not import the Island path.

## Locale configuration controls (BE03a OD-4, FE03)

- `content-schema-registry-locale-draft.ts` / `content-schema-registry-locale-config.ts` —
  pure editing model (tag list, source/default, intermediate-only fallback
  groups), client validation through the contracts `refineLocaleConfig`, pointer
  and control-id mapping, and the review diff. No React, no DOM.
- `use-locale-config-draft.ts` — the state hook (reveal-on-blur validation,
  focus requests, live announcements, submit guard).
- `ContentSchemaRegistryLocale{Tags,Selects,Chains,Review,Fields}.tsx` — the
  controls. The submitted pair travels as JSON text in the hidden fields
  `supportedLocales` and `fallbackChains`; the successor form submits `null` for
  both unless "Change languages and fallback orders" is chosen.
- `ContentSchemaRegistryLocaleSummaryView.tsx` — read-only protected detail.
- Server 422 locale messages are fixed BE03a strings; the DOM runtime shows
  only those (never other server text) and links each to its control by id.

## Step-up recovery, draft restore and review announcements (FE03, FE00)

- `content-schema-registry-step-up-classify.ts` — reads a 401 with the typed
  `CmsStepUpRequiredErrorSchema`: only `totp` counts, an empty or unsupported
  method list is a degraded "No verification method is available" state with
  the request ID, any other shape is a malformed degraded response, and a plain
  401 stays reauthentication. The runtime outcomes are `step-up-required`,
  `step-up-unavailable` and `step-up-malformed`.
- `content-schema-registry-step-up-draft.ts` — before navigating to
  `/step-up?returnTo=` (path plus query, path only above 512 characters, `/app`
  when still unusable) the form persists a tab-scoped sessionStorage draft:
  editable text and radio fields, the original Idempotency-Key and the expected
  version. Hidden transport fields, one-time codes, acknowledgements and the
  reviewer, subject and target person IDs are never written. The enhancement
  restores it once after step-up, announces "Verification complete. Review and
  confirm to continue.", focuses the commit control and never submits for the
  person; a version that moved opens the sync conflict.
- `content-schema-registry-review-flash.ts` and `ContentSchemaRegistryReviewFlash.tsx`
  — a decision or assignment success redirects, so the 201/200 body is unreadable.
  The runtime leaves a one-shot identifier-free note and the refreshed review
  announces the exact decision with the updated recorded and required counts, or
  the assignment state with its expiry.
- `setFormBusy(form, busy, saving)` sets the commit label to "Saving…" and
  `aria-disabled` on the locale fields while a command is in flight.

## Detail, activation result and mapping tests

- `ContentSchemaRegistryDetailFacts`, `...Definitions`, `...Bindings` and
  `...Artifact` render every browser-safe member of the CMS-03A-07 detail; a new
  contract member needs a row there and an alternative value in
  `content-schema-registry-s09-r4-mapping-detail.dom.test.tsx`.
- `content-schema-registry-runtime-dom-activation-result.ts` validates and
  renders the CMS-03A-04 `SchemaActivationResource`; an unverifiable body is
  never shown as a success.
- `content-schema-registry-runtime-dom-reapply.ts` holds the locale conflict
  rule: Reapply is enabled only over a server-disclosed newer version.
- The `content-schema-registry-s09-r4-mapping-*` tests are generated-fixture
  checks: each contract field must change the markup the real component
  renders, each form control must equal a request field, and each generated
  error code must reach one UI class.

## Extension rules

Keep browser code free of server secrets and private evidence. Add new commands
through the typed contracts and preserve explicit loading, failure, conflict,
and offline states in the corresponding interaction tests.

## Conventions

Use the existing `ContentSchemaRegistry` component naming and keep each
interaction state covered by its colocated test.

## Related links

- `.memory/wiki/specs/fe/03-cms-content-modeling.md`
- `.memory/wiki/operations/runbooks/content-schema-registry.md`
