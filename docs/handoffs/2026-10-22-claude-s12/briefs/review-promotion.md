# Promotion review brief (read-only) — Slice 12 WIP migrations and test corrections

You are an independent reviewer. You did not author what you review. Read-only: never edit repository files
except your own report; never run SQL, docker, supabase, pgTAP or race modules; you MAY run read-only Vitest
on focused files with the pinned toolchain if useful. Start every shell command with
`cd /home/rob/.codex/worktrees/phase2-slice12/WeJammin &&`.

## Purpose

Root will promote the WIP migrations of your scope from `supabase/migrations-wip/<lane>/` into
`supabase/migrations/` (immutable once promoted). Find what must be fixed BEFORE promotion.

## Check, for every migration in scope

1. **Security**: SECURITY DEFINER functions set a safe `search_path` (follow the repo convention); owner is
   the established CMS definer; `revoke all … from public, anon, authenticated` and execute granted only as
   the existing pattern does (service_role for `platform_api` wrappers); no direct table grants to browser
   roles; RLS stays forced; no dynamic SQL from user input; authority/capability/assignment checks match the
   BE03c authority rows (cite them); hidden vs visible 404/403 disclosure rules; no PII or content in
   audit/outbox/log payloads beyond the spec.
2. **Spec correctness**: behaviour matches BE03c/BE03b rows and the cited decisions (DEC-NNN in
   `.memory/wiki/decisions.md`); flag invented behaviour beyond the spec as well as missing behaviour.
3. **Promotability**: timestamps unique and ordered vs promoted files and other WIP lanes in scope; no edit to a
   promoted migration; `create or replace` patches of live functions reproduce the full live body (no lost tail
   — compare against the newest promoted/WIP definition); forward-only; any backfill of existing rows is safe
   on a populated database (NOT NULL additions, constraint validation, data rewrites); file ≤300 lines.
4. **Locks**: lock order follows the BE03c "Slice 12 lock order"/BE03b global order where the function takes
   locks.

## Check, for every test correction in scope (from the lane reports' `## Test corrections`)

The corrected assertion must be required by a cited spec line/decision; it must not weaken coverage (a removed
assertion needs proof the behaviour is unreachable or covered elsewhere — name where); fixtures must not
bypass producers (no direct active-row inserts that skip authority, no disabled triggers).

## Output

Report path given in your prompt. Sections: Scope (files + SHA-256), Findings table (id, severity
BLOCKER/MAJOR/MINOR/NIT, file:line, evidence, spec citation, proposed fix), Test-correction verdicts (accept /
reject with reason), Promotion verdict per lane (PROMOTE / FIX FIRST). Final message: verdict per lane,
counts by severity, report path + SHA-256. Be concrete; no generic advice; every finding must cite code and spec.
