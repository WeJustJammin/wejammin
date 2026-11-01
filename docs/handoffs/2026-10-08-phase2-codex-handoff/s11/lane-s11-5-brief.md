# Lane S11-5 — Slice 11 web surfaces + browser verification (read ORCH/lanes/COMMON.md first; LANE = slice11 checkout)
Inputs: FE03 .memory/wiki/specs/fe/03-cms-content-modeling.md rows for CMS-03B-05..09 and 15..18 (DEC-151 lists the line anchors: resource
union 361-364/377-392, operation union 521-555, components 592-598, pages 1095-1096/1495-1498, states 1547-1550, operation metadata
1676-1679, contract fields 1803-1806/1851-1854, error mapping 2578/2619-2625, tests 2760), IA03 CMS-08/09/13 flows, Slice 11 criteria
AC001-AC122 (especially the FE rows and AC049-AC084 consumer/verification rows), ORCH/s11/lane-s11-1-report.md (generated contracts),
ORCH/s11/lane-s11-4-report.md (Worker routes as they land), ORCH/lanes/NOTES.md, the Slice 10 web patterns (apps/web/src/components/
cms-editorial*, cms-editorial-pages, step-up detour store, cms-editor-dom.test-support.tsx teardown, real-route Playwright config
playwright.s09-real.config.ts project real-route-chrome and tests under tests/e2e real specs, s10-real-result.ts).
Ownership: apps/web/src/** (new components/pages/islands/proxies/route registry rows for workflow panel, review submit, reviewer queue,
review detail, decision with step-up, reviewer assignment create/revoke with step-up, schedule form with timezone/gap/fold handling, preview
mint (token shown once, never stored/logged), publish now, publication status that never presents 202/pending as public visibility),
web Vitest files, accessibility tests, and NEW Playwright real-route specs for Slice 11. No contracts/Worker/SQL edits (ask via NOTES).
Rules: consume generated contracts only; native link/button/form; focus management and announcements per FE03; map exact ApiError
tokens; retain input on failure; reconcile unknown mutation before retry; step-up recovery uses /step-up?returnTo=, never auto-replays,
refetches the CAS operand, requires confirmation, then submits the original idempotency key exactly once; refetch canonical state after
success; never leak tokens/manifests/person or party identifiers; draft preservation.
Method: contract-first TDD with RED observed; 100% coverage gate; axe checks; real-route Playwright only via ORCH/bin/lane-e2e.sh after the
Worker routes and SQL wrappers exist (start with unit/component/accessibility work against the contracts). Report ORCH/s11/lane-s11-5-report.md
with checkpoints. Final: pnpm type-check, lint, format:check. Final chat <=6 lines.
