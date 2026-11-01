# Lane `claude_s12_pwfix9` — capture server logs and telemetry in the real-route harness (AC-273 "logs or telemetry")

Read `docs/handoffs/2026-10-14-claude-s12/lane-rules.md` fully first; it binds you. Start EVERY shell command with
`cd /home/rob/.codex/worktrees/phase2-slice12/WeJammin &&`. Toolchain `PATH=/home/rob/.local/share/wejammin-toolchain/bin:$PATH`.
zsh does not word-split; `/bin/ls`, never bare `ls`. Run every command in the FOREGROUND (no `run_in_background`, no monitors).
Never run Playwright, db, supabase, docker or races (root runs the browser gate). Vitest on the support tests you touch, eslint,
prettier and an ad hoc `tsc --noEmit` are allowed. **Do not spawn sub-agents.** Report
`docs/handoffs/2026-10-22-claude-s12/lane-pwfix9-report.md`. No product change.

Root ruling on lane pw9's BOUNDARY 1 (`lane-pw9-report.md`): the gap is harness-only, so close it. Today the real-route API
Worker's logger is a no-op (`tests/e2e/support/content-schema-registry-api.ts` ~321-336, `createLogger: () => logger`), Wrangler's
stdout is inherited (`run-s09-real-servers.mjs` ~198, `stdio: 'inherit'`) and the Playwright `webServer` does not pipe it
(`playwright.s09-real.config.ts` ~85-95). Make the journeys able to scan what the servers actually log:

1. Replace the no-op with the PRODUCTION logger the Worker composes (find the factory `apps/worker` uses, with its redaction),
   writing each structured line to a sink file whose path comes from an environment variable set by the launcher. Never put the
   sink under `test-results/` (Playwright empties it at the next run — memory "Playwright empties test-results"); use
   `.lane-logs/e2e-server-logs/<run>/` or the run's own directory the launcher already creates.
2. Pipe the web server (Wrangler/Astro) stdout and stderr to a file in the same directory, still echoing to the console.
3. Telemetry: find every telemetry emitter the web and Worker code paths of these journeys call (analytics, tracing, metrics,
   event beacons). Capture each into the same directory if it has a sink, or record with lines that it has none in this harness.
4. Extend `tests/e2e/support/s12-pw9-scan.ts` (lane pw9's file; pw9 is finished and handed it over) to read the captured files
   at the end of each journey and assert no person id, auth-user id, decision reason, policy basis, diff value or canonical id
   appears (FE03 line 895), keeping its existing outbox/audit scan. A Vitest unit test for the reader (a seeded sink with and
   without a leaked value) proves the scan can fail.
5. Update `tests/e2e/support/README.md` and the launcher's comments. List exactly what root must run.

Final message to root: GREEN / PARTIAL / BLOCKED, report path + SHA-256, changed files with SHA-256, what is captured where, any
emitter left uncaptured with lines.
