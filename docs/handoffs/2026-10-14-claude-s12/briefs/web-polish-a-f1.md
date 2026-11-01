# Lane brief — `claude_s12_web_polish_a_f1` (Web polish A fix pass; review VERDICT PARTIAL)

Review `review-web-polish-a.md` (SHA `67555d81…`). Fix, RED first:
1. MAJOR F1: `components/cms-editorial/cms-editorial-entry-editor-stale-base.ts:29-45` — a 429 on the draft re-read
   after a 409 must NOT re-send the save command. Wait out `Retry-After` for the READ only, announce it as a read
   limit ("too many requests", not "too many saves"), then re-read; the command is re-sent only by the existing
   bounded rebase flow with its own idempotency rules, and the 429 loop counts toward the existing rebase limit.
   Replace the test that answers a stale re-send with 201 (the real server cannot) with a faithful one; prove no extra
   POST happens (Test corrections, cite the brief's "do NOT add retries to commands" and FE03 network contract).
2. MAJOR F2: revert test correction 1 and make the pattern designer's commit control show the stable pending label
   ("Saving…") while pending, as FE03 :1043, :898, :974, :1257 and DESIGN.md :187 require and every sibling form
   does; width preserved; label returns after settle.
3. Minors: correct the node-key blur "equivalent mutant" claim (add the killing test); make `cms-danger-action`
   effective on every CMS page that can show a destructive action (template pages, capability grants, …) and test
   it in the rendered stylesheet scope, not by string absence; bring `cms-editorial-conflict-controller.ts` back
   under 300 lines (pure extraction); cancel a refetch timer started by an in-flight canonical read on unmount;
   rate-limit notices update an existing empty live region instead of inserting a pre-filled one; the Retry-After
   parser accepts leading zeros (`007`) per RFC 9110 delay-seconds (lib change: keep every other behaviour; Web
   polish B uses this helper, re-read before editing).
Report: append `## Fix pass 1` to `lane-web-polish-a-report.md`. Files: polish A's own files and tests; NOT
`components/cms-governed-review/**` or template designer files (polish B), taxonomy or related files. Gates: focused +
full `apps/web` Vitest, `astro check`, eslint + prettier; mutation checks on scratch copies under
`<scratchpad>/claude_s12_web_polish_a_f1/` (batches under /bin/bash; SAVE the outputs); under `flock -s /tmp/wejammin-quiet.lock`.
