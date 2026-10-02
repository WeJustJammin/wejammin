# CMS editorial components

## Contents

Progressive-enhancement client for the CMS-05 entry create/edit workbench:
draft state, bounded autosave, the CMS-03B-01 revision mutation, and the
status, conflict, and capability-denial surfaces, with their colocated tests.

## Ownership

These modules own _client_ draft state, autosave cadence, mutation transport,
and error presentation. They do not own authorization, publication, entry
lifecycle, or persistence — those stay in the worker/API and database
contracts. The browser never reads protected entry values directly; the draft
arrives through an authorized loader boundary.

## Module map

- `cms-editorial-types.ts` — draft, async-state, access-variant, and typed
  resource shapes, plus `safeCmsEditorialErrorMessage`, which maps a server
  error code to fixed approved copy and never echoes the raw code.
- `cms-editorial-contracts.ts` — browser-local projection of the locked BE03b
  revision parsing. `packages/contracts/src/cms-editorial/` has landed for
  CMS-03B-01, so this module reuses its shared primitives and keeps only a
  guarded CAS-version parser plus the CMS-03B-03 history shapes the shared
  module does not export yet.
- `cms-editorial-entry-draft.ts` — local dirty tracking, per-field unsent
  values, and the changed-path/base-revision pair the mutation sends.
- `cms-editorial-autosave.ts` — bounded cadence: 3 s idle debounce with a
  30 s hard maximum while dirty, and coalescing when a save is requested during
  an in-flight save.
- `cms-editorial-runtime.ts` — the CMS-03B-01 revision POST with `If-Match`
  and an idempotency key, plus status-to-outcome mapping that keeps
  unverifiable results out of `success`.
- `cms-editorial-entry-create.ts` — browser projection of the locked
  CMS-03B-10 create contract: the shared request/resource/verification
  schemas re-exported, the honest boundary, and the fail-closed page resolver.
- `cms-editorial-entry-create-transport.ts` — the CMS-03B-10 initial create.
  Validates the body locally first, sends `Idempotency-Key` and never
  `If-Match`, requires a `201` body plus a `Location` that resolves to the
  returned entry before it reports `success`, rotates the idempotency key only
  on a definite refusal, and returns caller values unmutated so a denial can
  restore unsent edits.
- `cms-editorial-entry-draft-detail.ts` — browser projection of the locked
  CMS-03B-11 draft read: shared schemas re-exported, the honest boundary, and
  the fail-closed page resolver that keeps absent, forbidden, and unserved
  indistinguishable.
- `cms-editorial-entry-draft-detail-transport.ts` — the CMS-03B-11 protected
  read. No body, no `Idempotency-Key`, no `If-Match`, `cache: 'no-store'`, a
  strictly strong `ETag` captured verbatim for the next CAS, and a strict
  `EntryDraftDetailResource` for the addressed entry before `success`.
- `cms-editorial-runtime-dom-feedback.ts` — native-form feedback: busy state,
  focus without scroll, live-region announcements, and the focusable
  field-linked validation summary.
- `cms-editorial-entry-loader-boundary.ts` — the
  `local-production-read-bound-editor-loader-unwired` boundary: CMS-03B-11,
  its first-party proxy, Worker route, and named RPC adapter exist locally, but
  the authoring workbench has no verified loader; it reports `disabled`
  rather than fabricating a server-loaded draft.
- `CmsEditorialStatus.tsx` — the single polite-or-alert live region.
- `CmsEditorialSyncConflict.tsx` — multi-tab divergence; no last-write-wins.
- `CmsEditorialCapabilityGate.tsx` — typed denial reason without hinting
  whether the hidden entry exists.
- `apps/web/src/pages/app/cms-content-modeling/entries/` — the CMS-03B-10/11
  route shells and their structural route test. The draft-detail shell performs
  the real protected read; the create shell renders the boundary `503` until
  the `workflowPolicy` evidence source is defined.

## Extension rules

Keep browser code free of server secrets and private evidence. New mutation
fields go through the typed contracts, never ad-hoc objects. Preserve explicit
loading, failure, conflict, rate-limited, and unknown-outcome states, and keep
each behavior covered by its colocated test. The conflict-resolve suite is
split for the 400-line cap: `cms-editorial-conflict-resolve-contract.test.ts`
holds the contract projection,
`cms-editorial-conflict-resolve-transport.test.ts` the transport, and
`cms-editorial-conflict-resolve-test-support.ts` the shared fixtures. Do not
wire routes or navigation here that would claim an available draft or policy
source. FE03 authorises CMS-03B-01..11, and
`packages/contracts/src/cms-editorial/` registers CMS-03B-01, CMS-03B-10, and
CMS-03B-11. The Worker serves their protected routes, and the web proxies are real:
`apps/web/src/server/cms-editorial-platform-mutation.ts` and
`cms-editorial-platform-reads.ts`. The draft-detail page is therefore wired and
relays the upstream truth; the create page stays fail-closed because the locked
request also needs a `workflowPolicy` evidence object that no served schema
exposes.

## Conventions

Tests use `// @vitest-environment jsdom` with React `act`, `createRoot`, and
`IS_REACT_ACT_ENVIRONMENT` (the flag follows the `platform-configuration`
React-island tests; the `content-schema-registry` siblings render static
markup). Assertions prefer accessible names, roles, and live-region attributes
over styling, since autosave, connection, and conflict states must never rely
on colour.

## Related links

- `.memory/wiki/specs/be/03b-editorial-workflow-publication.md`
- `.memory/wiki/specs/ia/03-cms-content-modeling.md`
- `.memory/wiki/specs/fe/03-cms-content-modeling.md`
- `apps/web/src/components/content-schema-registry/README.md`
