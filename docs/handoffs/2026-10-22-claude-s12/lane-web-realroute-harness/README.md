# Load-on-intent harness (lane claude_s12_web_realroute, 2026-10-23)

A real-Chrome proof of the load-on-intent mechanism (`apps/web/src/components/cms-editorial-workflow/cms-lazy-intent.ts`,
`cms-lazy-view.tsx` `loadViewOnIntent`, `CmsWorkflowCommandFrame.tsx` `lazyRegion`, `CmsWorkflowFields.tsx` locks).
It needs no database: `server.tsx` server-renders two gated forms built from the real command frame and the real
text field, `client.tsx` hydrates them behind `loadViewOnIntent`, `drive.mjs` serves the bundle (esbuild, split chunks)
and drives it with the installed Chrome.

Run (pinned toolchain, from this directory copied anywhere under the worktree's reach):
`node build.mjs && node drive.mjs`. Paths inside point at the worktree
`/home/rob/.codex/worktrees/phase2-slice12/WeJammin`. `drive-output.txt` is the recorded run.

Proved: a region in the viewport loads at once and releases its locks; a region below the fold stays read-only until
it scrolls into view; with no IntersectionObserver the chunk is not requested until the pointer is over the region;
a submit pressed before hydration does not navigate, arms the region and is replayed exactly once after hydration;
Playwright `fill` on a locked field waits for the release and its value reaches the form state.

## Contents

`build.mjs` (esbuild bundle with split chunks), `client.tsx` (hydration behind `loadViewOnIntent`), `server.tsx`
(server render of the two gated forms), `GateForm.tsx` (the form built from the real command frame and text field),
`drive.mjs` (static server plus the Chrome driver) and `drive-output.txt` (the recorded run).

## Ownership

Written by lane `claude_s12_web_realroute`; the root orchestrator (`claude_root`) owns it after the lane closed. It is
evidence for the lane report `../lane-web-realroute-report.md`, not product code and not a CI suite.

## Extension

Add a scenario to `drive.mjs` and a form to `GateForm.tsx`, rerun `node build.mjs && node drive.mjs`, and replace
`drive-output.txt` with the new recorded run. Product behaviour belongs in `apps/web` and its real-route specs.

## Conventions

Import product modules by their worktree paths, never copies; record every run's output verbatim. No credentials,
tokens or personal data.

## Related links

- `docs/handoffs/2026-10-22-claude-s12/lane-web-realroute-report.md`
- `apps/web/src/components/cms-editorial-workflow/README.md`
- `docs/handoffs/2026-10-22-claude-s12/README.md`
