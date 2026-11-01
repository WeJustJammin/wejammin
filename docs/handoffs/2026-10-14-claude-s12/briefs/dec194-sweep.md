# Lane brief — `claude_s12_dec194_sweep` (merge convergence recovery sweep, SQL + Worker)

Owner decision DEC-194 (end of `.memory/wiki/decisions.md`); spec text now in BE03c
`.memory/wiki/specs/be/03c-composition-taxonomy-localization.md` "Merge convergence recovery (DEC-194 …)" inside
"Merge convergence Job disposition". Design input: `lane-worker-taxonomy-terms-report.md` fix pass Requests to root #1
(candidate set, idempotency namespace per failed job, bounds, pgTAP list). Precedent: CMS-03C-19 sweep (SQL claim/execute
+ Worker scheduled handler) and `platform_private.accept_job_with_outbox`.
RED first at each layer:
1. SQL: WIP `supabase/migrations-wip/dec194/`, timestamps `20261014190000`-`190499`: `platform_private.cms_reconcile_taxonomy_merge_converge()`
   (SECURITY DEFINER, CMS definer owner, `search_path = ''`, executable by no API role) and `platform_api` wrapper
   executable by `service_role` only, answer `{requested}`. pgTAP: no job; no work; live job; failed job with work;
   replay of the same tick; 15-minute bound; 3-generation stop; continuation already exists; grants. Staged lane
   `dec194` + run the taxonomy-terms suites to prove no regression.
2. Worker: scheduled tick adapter + registration (precedent: the CMS-03C-19 sweep handler and its runtime wiring),
   telemetry/log per the runbook, tests; strict answer parsing.
3. Runbook `docs/runbooks/platform/cms-taxonomy-merge-converge.md`: replace "the open gap" with the sweep; keep the
   runbook sync test green (it parses BE03c).
Do not edit spec text (report any needed change). Report `docs/handoffs/2026-10-14-claude-s12/lane-dec194-sweep-report.md`.
Gates: staged runner; focused + full Worker Vitest, worker `tsc`, eslint + prettier.
