# CMS editorial components

## Contents

The client for the CMS-05/06/07 editorial surfaces: the typed create form, the
draft editor with bounded autosave, the conflict resolution form, the revision
history, comparison and restore review, and the entry list, with their
transports, state machines and colocated tests.

## Ownership

These modules own _client_ draft state, autosave cadence, mutation transport,
and error presentation. They do not own authorization, publication, entry
lifecycle, or persistence — those stay in the worker/API and database
contracts. The browser never invents authority: the request evidence, the
`baseRevision` and the `If-Match` come only from verified server responses, and
no server message is ever rendered (fixed copy only).

## Module map

- Create (CMS-03B-10): `CmsEditorialEntryCreateIsland.tsx` over
  `use-cms-editorial-entry-create.ts`, `cms-editorial-entry-create-values.ts`
  (what is sent) and `cms-editorial-entry-create-submit.ts` (the command with
  `/fields/{id}` pointers, a key, no `If-Match`); transport in
  `cms-editorial-entry-create-transport.ts`.
- Draft editor (CMS-03B-11 / -01): `CmsEditorialEntryEditorIsland.tsx` over
  `use-cms-editorial-entry-editor.ts` and the controller
  (`cms-editorial-entry-editor-{state,context,save,outcomes,controller}.ts`):
  canonical base and unsent values kept apart; autosave through
  `cms-editorial-autosave.ts` (3 s idle, 30 s hard maximum); an unknown outcome
  replays the identical request under the same key; the next `baseRevision` /
  `If-Match` come from the committed `entryVersion`. `CmsEditorialEditorBanners.tsx`,
  `CmsEditorialStatus.tsx` (the one polite live region),
  `CmsEditorialSyncConflict.tsx` (no last-write-wins) and
  `CmsEditorialCapabilityGate.tsx` carry the non-field states.
  `cms-editorial-draft-values.ts` projects a verified draft onto its fields.
  Reconciliation never overwrites a field edited after dispatch (a merged 201
  keeps it; a field both sides changed stops in `sync-conflict`), and a stale
  base is rebased at most three times in a row with backoff
  (`cms-editorial-entry-editor-{stale-base,rebase}.ts`) before an explicit,
  author-resumable state. Leaving with unsent work is guarded:
  `use-cms-editorial-leave-guard.ts` arms `beforeunload` only while work is
  unsent and `CmsEditorialLeaveConfirmation.tsx` is the inline confirmation
  (save and leave, leave without saving, keep editing). Save draft is never
  disabled while a save is in flight (a disabled focused control drops keyboard
  focus to `<body>`); it is `aria-busy` and the controller refuses a second
  save, and the interrupting states (conflict, expired session, denied) take
  focus on their alert.
- Conflict (CMS-03B-12 / -02): `CmsEditorialConflictResolveIsland.tsx`,
  `CmsEditorialConflictPath.tsx`, `use-cms-editorial-conflict.ts`,
  `cms-editorial-conflict-{controller,controller-types,state,copy,
detail-transport}.ts` and `cms-editorial-conflict-resolve.ts` (the resolve
  transport). No winner is inferred; a 409 re-reads the conflict and keeps only
  choices whose preimages are unchanged.
- History / restore (CMS-03B-03 / -04): `CmsEditorialRevisionHistory.tsx`,
  `CmsEditorialRevisionCompare.tsx`, `CmsEditorialRestoreForm.tsx` (an inline
  review that restores the LEFT revision), `cms-editorial-restore-submit.ts` and
  `cms-editorial-restore-response.ts`.
- Entry list (CMS-03B-13): `CmsEditorialEntryList.tsx`,
  `cms-editorial-entry-list.ts` (the shared contract re-exported).
- Shared: `cms-editorial-runtime.ts` (the revision POST),
  `cms-editorial-mutation-errors.ts` (status/outcome mapping, verified
  `reasonCode`), `cms-editorial-reason-copy.ts` (closed vocabulary and its copy),
  `cms-editorial-app-routes.ts` (APP routes; a command navigates to one derived
  from the verified body, never to an API `Location`),
  `cms-editorial-entry-draft-detail*.ts` (the CMS-03B-11 transport),
  `cms-editorial-contracts.ts` / `cms-editorial-types.ts` (shared contracts
  re-exported and browser types), `cms-editorial-runtime-dom-feedback.ts`.
- `*.test-support.ts` — fixtures parsed through the real contracts, a fake clock
  and the editor harness.

## Extension rules

Keep browser code free of server secrets and private evidence. New mutation
fields go through the typed contracts, never ad-hoc objects. Preserve explicit
loading, failure, conflict, rate-limited, and unknown-outcome states, and keep
each behavior covered by its colocated test. A write that may have been applied
keeps its key and replays the identical request; a definite refusal rotates it.
Never adopt the revision resource's `version` as an `If-Match` (it is the
snapshot's own, always 1): adopt `entryVersion`. Files stay within the size
limits (components 200 lines, lib 300, tests 400); the controller and the
conflict suites are split for that reason.

## Conventions

Island tests use `// @vitest-environment jsdom` with the native-DOM driver in
`../cms-editorial-fields/cms-editor-dom.test-support.tsx`; server-rendered views
use `renderToStaticMarkup`; state machines are tested without React. Assertions prefer accessible names, roles, and live-region attributes
over styling, since autosave, connection, and conflict states must never rely
on colour.

## Related links

- `.memory/wiki/specs/be/03b-editorial-workflow-publication.md`
- `.memory/wiki/specs/ia/03-cms-content-modeling.md`
- `.memory/wiki/specs/fe/03-cms-content-modeling.md`
- `apps/web/src/components/content-schema-registry/README.md`
