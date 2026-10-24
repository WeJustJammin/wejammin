# Lane report: codex related-content test-fixture reconciliation (2026-10-15)

## Status

FROZEN. Fixture reconciliation only; no production, spec, contract or tracking file was touched.
No validation was run by this lane (see "Own validation"). Root 6.1 owns all validation.
After the root broader Vitest run (20 files, 290/290, exit 0), a narrow formatter execution was released for
the route test alone; it changed formatting only (see "Formatter").

## Scope and authority

- Worktree `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`, HEAD `b16edb54` (unrelated dirty state preserved).
- Primary checkout `/home/rob/Projects/WeJammin` was read-only and never written.
- Requested model: Phils-Charm/deepseek-v4.1-flash (high). No fallback was needed or taken.
- Governed by DEC-195 (owner, 2026-10-15): `cmsRelatedContentRead` provides a protected GET of the saved rule,
  assigned author or editor with source edit gate, 403 for a visible source without edit authority, 404 for a
  hidden or absent source. The old SG-S12-03 read-only boundary is retired.

## The four writable paths

All edits are test fixtures (and this report). Every path below is absolute.

1. `/home/rob/.codex/worktrees/phase2-slice12/WeJammin/apps/web/src/components/cms-related-content/CmsRelatedContentForm.candidates-rate-limit.test.tsx`
   sha256 `e6af408fd0cdd8122874c2cc798e8668c6035a9571d601f43d1e973e870a15c4`
2. `/home/rob/.codex/worktrees/phase2-slice12/WeJammin/apps/web/src/components/cms-related-content/CmsRelatedContentForm.lists.test.tsx`
   sha256 `0250277812b8fdcf2b3a9d85b0d501b571f41536b70ed61c0ca7710a928a5801`
3. `/home/rob/.codex/worktrees/phase2-slice12/WeJammin/apps/web/src/pages/app/cms-content-modeling/entries/[entryId]/related-content-route.test.tsx`
   sha256 `39e517b19e4150410fe8843cd797cac96bcc9259527bdac9d39d69ecfe732c06` (pre-format: `3ba5f33ad7dedf39e1c4b8beda5dea7128cd3475d40d1682b1f64043c1e1f42b`)
4. `/home/rob/.codex/worktrees/phase2-slice12/WeJammin/docs/handoffs/2026-10-14-claude-s12/lane-codex-related-fixtures-2026-10-15.md` (this file, new)

## Root RED receipts (supplied by root, not re-run here)

- Astro web types: `/tmp/wejammin-codex-web-types-Vt5byM/astro-check.log` - 3 errors in these files:
  - `CmsRelatedContentForm.candidates-rate-limit.test.tsx:137:9` ts(2353): `enabled` does not exist in `RelatedCandidatesOptions`.
  - `CmsRelatedContentForm.lists.test.tsx:10:10` ts(2305): no exported member `SAVING_UNAVAILABLE`.
  - `related-content-route.test.tsx:116:32` ts(2322): a parsed known-object rule is not a `Promise<Response>`.
- Vitest: `/tmp/wejammin-codex-related-fixtures-red-lLlkqS/red.json` - 34 cases across 3 files, 31 pass, 3 fail,
  all in the route file: the old read-only case expected `view`; the editable case fed a known-object stub instead
  of a `Response`; the read-count case expected 2 reads and saw 4.

## What each edit changed

1. Rate-limit test: deleted only the obsolete `enabled: true` member (the property is gone from
   `RelatedCandidatesOptions`). Call counts (1/1/2) and every Retry-After guard are preserved.
2. Lists test: removed the `SAVING_UNAVAILABLE` import; renamed the first case to
   "starts from an empty saved rule with the save control available" and replaced the obsolete
   `not.toContain(SAVING_UNAVAILABLE)` absence check with a positive
   `expect(buttonNamed(container, 'Save related content').disabled).toBe(false)`. All list and capacity
   assertions are preserved.
3. Route test: `bindingFor` gained `savedRule?: () => Response` and now dispatches the exact
   `/api/v1/cms/entries/${ENTRY_ID}/related-content` path separately, defaulting to a FRESH
   `Response.json({ rule: null })`. The parsed known-object read stub was removed; the positive editor-form case
   now uses the real composed binding (only the platform binding is replaced). The obsolete read-only case was
   replaced with an actual draft-success plus `savedRule` 403 `RELATED_CONTENT_FORBIDDEN` case, asserting the exact
   loader access-denied notice ("This account cannot edit related content for this entry.") and that no candidate
   list was read; the positive editing case keeps all pin, exclusion, archived and no-secret assertions. The
   read-count case now expects 3 reads on the entry, saved-rule and list paths, with `?limit=50` and the session
   cookie preserved.

The notice text and the `403`/edit-authority behavior were read from `load-related-content-page.ts` and the proxy
contract; nothing was invented and no authority was weakened.

## Boundary notes (not changed here)

- FE03 :1072/:1601 (source edit gate) and :1174 (input preserved on rate limit) are the governing spec lines.
- The read's `RelatedContentResource.derivedRule` is `{key, version}` only, so a saved `maxCandidates` is unknown
  and must stay an explicit re-entry (SAVED_BOUND_UNKNOWN). Nothing here infers it or changes production.

## Own validation: UNRUN

This lane ran no tests, lint, type-check, build, DB, runtime, network or git mutation, per its brief.
No GREEN is claimed for these files. Root 6.1 owns validation and the RED->GREEN transition.

## Root broader receipt (supplied by root, not re-run here)

- Root broader related Vitest run: 20 files, 290/290, exit 0, `/tmp/wejammin-codex-related-green-HfHcdn/green.json`.
- Root `prettier --check` exited 1 for the route test only; the two form tests were format-clean.

## Formatter (narrow execution, released by root)

After the root broader run, root released a narrow formatter execution. Run from the S12 cwd with
`PATH=/home/rob/.local/share/wejammin-toolchain/bin:$PATH`, exactly one command:

```
pnpm exec prettier --write "/home/rob/.codex/worktrees/phase2-slice12/WeJammin/apps/web/src/pages/app/cms-content-modeling/entries/[entryId]/related-content-route.test.tsx"
```

Exit 0 (92 ms). The two form tests were not touched. No other command, test, lint, type-check, build, DB or
runtime step ran. The pass was format-only: every assertion and case is byte-identical in meaning, the file is
still 244 lines, and the only lines over 80 columns are unbreakable import paths, block comments and `it` titles.
Format-only hash: `39e517b19e4150410fe8843cd797cac96bcc9259527bdac9d39d69ecfe732c06`.

## Freeze

The four paths above are frozen at the hashes recorded here (route test at its format-only hash). The three test
files are now format-clean; no further edits are pending from this lane.
