# Lane claude_s12_pw9 report

## Status
PARTIAL (nothing run). Five new Playwright specs (six tests, J7 to J12) and five new support modules for the AC-273 journeys that were still
undriven. prettier --check clean, eslint exit 0 on all ten files, ad hoc `tsc --noEmit` reports only the known `Cannot find module 'node:crypto'`
(no `@types/node` in this worktree; identical for every existing spec). Playwright, the stack and db are not permitted to this lane, so every
proposal citation is "pending root run". The specs are NOT registered in the Playwright configs (not in this lane's claim): see Requests to root.
AC-273 stays `partial`: the server LOG LINES of the scan cannot be captured by a spec in this harness (BOUNDARY 1). HEAD at start: 85ab5ff0.

## Scope (brief items)
| Item | Outcome | Test |
|---|---|---|
| 1 dependency invalidation returns a subject to draft | written | J7 |
| 2 linked pattern update accepted and (another instance) detached | written; the scan job is a stand-in (BOUNDARY 2) | J8 |
| 3 protected decision inside a journey, submit and assignment in the browser | written | J9 |
| 4 pattern created and assigned in the browser, then scheduled | written | J10 |
| 5 identifier scan extended to server logs and telemetry | extended to IndexedDB names, outbox payloads and audit rows; log lines are a BOUNDARY (1) | J7 to J12 |
| 6 keyboard-only at 640x400 for template and pattern | written (template J11, pattern J12) | J11, J12 |

## Specs, titles, project (all project `real-route-chrome`)
1. tests/e2e/phase-02-slice-12-dependency-journey-real-route.spec.ts
   - `[P2-S12-AC-273] J7 a dependency change returns approved patterns to draft: the owner is refused in the browser, the recheck job invalidates the other, and each review page says so`
2. tests/e2e/phase-02-slice-12-linked-update-journey-real-route.spec.ts
   - `[P2-S12-AC-273] J8 a linked pattern update is accepted on one entry and detached on another: the scan job appends the update, the diff shows the new text, and a fresh load shows both outcomes`
3. tests/e2e/phase-02-slice-12-protected-journey-real-route.spec.ts
   - `[P2-S12-AC-273] J9 a protected vocabulary is defined, submitted, assigned to two reviewers, decided by the base reviewer and then its specialist, and activated, all in the browser`
4. tests/e2e/phase-02-slice-12-pattern-journey-real-route.spec.ts
   - `[P2-S12-AC-273] J10 a pattern is created in the browser, submitted, assigned, decided and scheduled by three people`
5. tests/e2e/phase-02-slice-12-keyboard-journeys-real-route.spec.ts
   - `[P2-S12-AC-273] J11 a template is defined, submitted, assigned, decided and scheduled by keyboard alone at a 640x400 viewport`
   - `[P2-S12-AC-273] J12 a pattern is submitted, assigned, decided and scheduled by keyboard alone at a 640x400 viewport`
Each spec builds its own world (`prepareJourneyCast`), types, patterns and entries; none depends on another spec's fixture state.

## Files (path, lines, SHA-256)
| Path | Lines | SHA-256 |
|---|---|---|
| tests/e2e/phase-02-slice-12-dependency-journey-real-route.spec.ts | 202 | 1638c5d8a4e0528aa90239acc3f13e35d5e52ac4add23beb642f9f465bf3e171 |
| tests/e2e/phase-02-slice-12-linked-update-journey-real-route.spec.ts | 206 | 26807cff08e9bf33baf99115188bb3ea2099e23f49eb0e8207ca68842a7c428e |
| tests/e2e/phase-02-slice-12-protected-journey-real-route.spec.ts | 199 | 3d8f017d42cb6ce8f58aa74244d6a0a4bf5804c395c1588bf1b6286868dd25b0 |
| tests/e2e/phase-02-slice-12-pattern-journey-real-route.spec.ts | 125 | 24643be1c16486f1b0bae4d6f58bdbe2e9da690bc058b028dc9b3387e4d25082 |
| tests/e2e/phase-02-slice-12-keyboard-journeys-real-route.spec.ts | 169 | 5e919a6b898c1d48a0db7decc2bbba80956f398f2cb1bf1f1d57c9a32923b374 |
| tests/e2e/support/s12-pw9-world.ts | 187 | 4a380dbc60f4fc6c2bef16db2b2507da680df3952df20c08ca55f2223c61a705 |
| tests/e2e/support/s12-pw9-jobs.ts | 146 | a35606bcca909bf0087321abb71ad542ba9a87ec53c515225ea95115810e783c |
| tests/e2e/support/s12-pw9-scan.ts | 99 | e9e38c9a226a5ec77638b11f945f493c7f96842ab9141161588f87cf5b34b993 |
| tests/e2e/support/s12-pw9-flow.ts | 247 | 5cac4d877af253b5da326d66a964ca3cbe479f43f988e413b98458880054e341 |
| tests/e2e/support/s12-pw9-keys.ts | 242 | 03265cff6c11490d26f385b46e94aecfe6a4d4834376ba7495a022edc0d97c05 |
| docs/handoffs/2026-10-22-claude-s12/recite9/pw9-proposals.json | n/a | see final message |
No existing file was edited. Scratch: `<scratchpad>/claude_s12_pw9/` (tsconfig, check script, file list only).

## What each journey does, and its assumptions
Common: `prepareJourneyCast` (pw7 flow): designer, owner (with `cms.template_designer`), reviewer (real `cms.reviewer` grant), author, curator.
Every label and sentence is taken from the component sources; person ids, decision reasons, diff texts are run-unique and scanned in URLs,
console, local/session storage, IndexedDB names, outbox payloads and audit rows (`s12-pw9-scan.ts`).

### J7 dependency invalidation (item 1)
Rule: BE03c "Invalidation" (line 1494) and "Governed activation" step (4) (line 1490, DEC-227): a pattern that nests another freezes the nested
VERSION; when the nested pattern gets an activated successor the frozen version is superseded and the stored review (still `approved`) is stale.
Two things recheck it: CMS-03C-09 step 4 (the owner's activate, committed invalidation, 409 `dependency_changed`) and the job
`cms.governed_review.recheck` (consumer of `cms.pattern.activated.v1`). The test drives both, one subject each:
child pattern active (API); two patterns nest it; the first is submitted from its page, assigned and decided in the browser, the second approved
through the routes; the child gets an activated successor (`savePatternVersion` with `expectedVersion`/`If-Match` "1"); control: both reviews still
`approved` (DB); the owner presses Activate on the second in the browser and the page says "A dependency of this version changed, so its review was
invalidated and the version is back to draft. Nothing was activated or scheduled." (`governed-activation-refusal.ts` MOVED); DB
`invalidated|dependency_changed`, pattern `draft`, no activation event; the recheck job (production RPCs, below) returns `invalidated 1,
dependencyChanged 1, unavailable 0` (the second is already not live); both review pages, loaded afresh, say `State: Invalidated`, `Subject: Draft`
and the invalidated copy and offer no "Activate now" radio; the first pattern's page says `Lifecycle: Draft`.
Assumptions: the pgTAP control (`gaps_pattern/040-activation-recheck`) holds over HTTP (stored review reads approved after the supersede); the job
counts are exactly 1/1/0 (only reviews of this lineage depend on the child); a top-level `pattern` node is accepted by CMS-03C-12 and the pattern
page renders it; the refusal sentence is shown as page text by the activation form.

### J8 linked update accepted and detached (item 2)
Pattern v1 active; an author places it linked at slot `/` into two entries from the instance-insert form (the AC-111 flow); v2 (changed `title`)
saved as the successor and activated; the scan job appends a `pending_diff` row per placement (asserted DB: 2 appended, `pending_diff|linked|1`);
on entry one: row says "Update available", "Pinned to pattern version 1"; Review update opens "Update for /root1", "Pinned to pattern version 1;
version 2 is available.", "1 changed path, 0 collisions", "Changed in the new version. No choice is needed.", base and theirs regions hold the two
texts; Accept update (POST pattern-updates, status < 300, strong If-Match) shows "Update applied", DB `active|linked|2`; on entry two the same
review and "Detach as a local copy" shows "Detached", DB newest row `detached`; fresh loads show "Up to date" / "Pinned to pattern version 2" and
"Local copy" with no Review update control. Assumptions: the accepted row's state is `active` (as a placement on a draft is, AC-111); the update
POST answers 200/201 (asserted `< 300`); entries are `active` with a derived `draft` state so the scan selects them.

### J9 protected decision in a journey (item 3)
Vocabulary over a `cms.disclosure.policy` type (the AC-075 world): defined in the form, submitted from its page; review page: "Risk class: Protected",
"0 of 2 decisions recorded.", `cms.reviewer.policy`; the owner assigns the base reviewer and then the specialist in the browser (2 assignment
rows); base approves: still "State: Open", "Subject: In review", "1 of 2 decisions recorded.", slot `cms.reviewer`; no activation radios yet;
specialist approves: "State: Approved", "Subject: Approved", "2 of 2 decisions recorded.", two decision records; the owner activates in the browser;
the vocabulary page says "Lifecycle: Active". Assumptions: both reviewers appear in the assignment list once the owner has granted `cms.reviewer`
through CMS-03A-15 (`grantReviewerViaApi`, as `prepareJourneyCast` does for the ordinary reviewer); the form takes the protected type key as free text.

### J10 pattern created in the browser then scheduled (item 4)
The `/patterns/new` form (key, content type, one top-level block of an owner-registered block, props, Create draft: 201, ETag "1"), submit from the
page, owner assigns, reviewer decides, owner schedules (CMS-03C-09 `schedule`). DB: `scheduled`, exactly one `pending` schedule row, no activation
event; pages say "Scheduled activation: pending.", "Subject: Scheduled, not active", "Lifecycle: Scheduled". Note: the brief wrote CMS-03C-07/-08
for the schedule; scheduling is CMS-03C-09 (BE03c line 1490), taken from the review page the pattern page links to.

### J11 / J12 keyboard-only at 640x400 (item 6)
`s12-pw9-keys.ts`: Tab (Shift+Tab to return), Space, Enter, ArrowDown and typed text only; `expectNoHorizontalScroll` on each page. J11: template
key, content type, locale, audience, Create draft, the page's link, then submit, assign (reviewer chosen with ArrowDown, "Assignment ends" typed),
decide (the J1 keyboard branch), schedule (radio by arrow keys, time zone and local time typed). J12: the same for a saved pattern. Assumptions
(first-run risk, adjust exactly): (a) the date-time field takes en-US segment order and is verified by value, with two ways of leaving the year;
(b) a closed select changes on ArrowDown; (c) the activation radios are entered at any radio and left on "Schedule activation"; (d) every control is
reachable within 80 Tab presses.

## Job stand-ins (BOUNDARY 2)
`s12-pw9-jobs.ts` runs, as the Worker service credential through Kong/PostgREST (`tokenFor('service_role')`, `callRpc`), exactly the RPCs the
Worker's queue consumers call: `cms_governed_recheck_resolve_event` then `cms_recheck_governed_reviews` (`{ eventId, kind, refId, cursor }`), and
`cms_scan_linked_pattern_updates` (`{ patternId, patternVersionId, cursor, correlationId }`). It does not write a row. Reason: the real-route
launcher (`tests/e2e/support/run-s09-real-servers.mjs`) starts the API Worker and the web server only; nothing relays the outbox to the platform
queue and nothing consumes it. Both RPCs are `service_role`-only and in no browser route (`linked-scan/rpc-names.ts`, `governed-recheck/rpc-names.ts`).
The journeys still drive every browser step (review update, accept, detach, activate refusal, review pages); the job body is what the stand-in runs.

## Open items / BOUNDARY
1. **Server log lines and external telemetry are not capturable (item 5).** The real-route Worker is built with a no-op logger
   (`tests/e2e/support/content-schema-registry-api.ts` lines 321-336: `const noop`, `const logger`, `createLogger: () => logger`); wrangler's stdout
   is the launcher's (`tests/e2e/support/run-s09-real-servers.mjs` line 198, `stdio: 'inherit'`) and Playwright's `webServer` does not pipe it
   (`playwright.s09-real.config.ts` lines 85-95, no `stdout: 'pipe'`); the only Worker console line, `[s10-rpc]` (`s10-real-editorial.ts:63`), goes
   the same way. A capture needs an edit to one of those three existing files (outside this lane's claim). What IS captured and scanned: browser
   URLs/requests/navigations/console, local/session storage and IndexedDB names, `platform_private.outbox_events` (payload, dead-letter reason, last
   error code) and `audit_private.audit_events` rows. Person ids are skipped in `cms.capability.grant.changed.v1` events (their payload names the
   subject person by design: `20261002143000_cms_revoke_capability_grant.sql` line 75).
2. **No queue consumer or outbox relay in the harness**: the recheck and linked-scan jobs run through their production RPCs (above).
3. Keyboard-only coverage is the template and pattern submit/assign/decide/schedule; not the pattern tree editor, the vocabulary define/assign, the
   diff accept/detach, or the term, locale and related pages. The protected decision is shown for a vocabulary subject.
4. `canonical id` in the brief's scan: this lane scans person ids, auth-user ids, decision reasons and diff texts (FE03 line 895 also names policy
   basis, canonical ids, assignment identifiers). Canonical-domain ids appear only in taxonomy journeys with a canonical overlap domain, which none
   of these journeys declares; assignment ids and the policy basis are not scanned. Route path parameters (review, vocabulary, pattern key, entry,
   and the instance id in `/instances/{id}/update-diff`) are the routes' own and allowed in URLs.

## Requests to root
1. Register the five specs in `playwright.s09-real.config.ts` `testMatch` AND `playwright.config.ts` `testIgnore`:
   `phase-02-slice-12-dependency-journey-real-route.spec.ts`, `phase-02-slice-12-linked-update-journey-real-route.spec.ts`,
   `phase-02-slice-12-protected-journey-real-route.spec.ts`, `phase-02-slice-12-pattern-journey-real-route.spec.ts`,
   `phase-02-slice-12-keyboard-journeys-real-route.spec.ts`.
2. Run (project `real-route-chrome`, one worker, `pnpm db:start && pnpm db:reset` first). Exact titles: `recite9/pw9-proposals.json` (`add[].title`).
3. Add module-map lines to `tests/e2e/support/README.md`: `s12-pw9-world.ts` (pattern save/successor/nested, approve-only chain, DB readers),
   `s12-pw9-jobs.ts` (the two job stand-ins), `s12-pw9-scan.ts` (browser + outbox/audit scan), `s12-pw9-flow.ts` (mouse steps), `s12-pw9-keys.ts`
   (keyboard-only steps). Existing file, outside claim.
4. Decide on BOUNDARY 1: to close "logs" a one-time harness edit is needed (webServer `stdout: 'pipe'` plus a capturing logger in
   `content-schema-registry-api.ts`, or a log file the launcher tees); say so and a follow-up lane can add the scan to `s12-pw9-scan.ts`.
5. After a run, cite per `pw9-proposals.json`; keep AC-273 `partial` (it states what remains).
