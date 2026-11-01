# DEC-197 injected host renewal — implementation freeze

Native author: `gpt-6.1-sol` / `ultra`. Worktree:
`/home/rob/.codex/worktrees/phase2-slice12/WeJammin`.

Status: **author UNRUN; root normalization, behavior gates and independent review pending**.
The filename records the released GREEN implementation lane, not a passing result.
Only seven NEW injected modules and this NEW handoff were authored. No existing
production, test, SQL, tracker, configuration or registration file was edited.

## Authority and observed RED

- Governing sources: `briefs/codex-dec197-upgrade-reset-identity-renewal.md` and
  all143 lines of `briefs/codex-dec197-renewal-contract-plan.md`.
- Existing source authority: strict `delivery-receiving-upgrade-target.mjs`
  identity/target helpers, `local-child.mjs:proveLease`,
  `local-inventory.mjs:readRegular/sha256/manifestHash`, and fixed S11 `SUPABASE`
  plus `MIGRATION` from `local-target.mjs`.
- Root supplied actual104-case RED: pure28/local14 PASS, host62 availability FAIL;
  receipt SHA256 `dda773241faefcbdcbaaeb4c0164cfcf1c4a34fd3c2bc600849f1fd0a8e99518`.
  This author did not execute or reinterpret that run as behavioral GREEN.
- Frozen host IDs H01–H12 retain all62 instances, including first-recovery drift,
  prelaunch six-artifact byte/inode faults, pending double-entry refusal,
  retained native PID/daemon work, and all nonempty backend-name cases.

## Implemented split

All module basenames below begin `delivery-receiving-upgrade-host-` in
`infra/database-upgrades/`.

| Module | Responsibility |
| --- | --- |
| `reset.mjs` | Explicit factory; private WeakMap handles; synchronous admission; registered/running/uncertain/consumed lifecycle; no second spawn on replay/overlap; fresh recovery checks. |
| `request.mjs` | Closed fixed-command/target/lease/source/inventory request; private Buffer copies; lossless exact value comparison; explicit dependency checks. |
| `boundary.mjs` | Live inherited-FD/FLOCK/ancestor proof; observed binding and physical identity; unchanged owner/OID/nonsecret ACL/settings-key envelope; actual source/applied inventory. |
| `source.mjs` | Derive repository from actual linked ALT tests/seed; complete ordered promoted/prefix/staged bytes; promoted-first/WIP parity; exact080; explicit ALT config and frozen seed/source checks. |
| `executables.mjs` | Independent native binding; fixed S11 shim/package/native paths; all six files' actual hashes/dev/inode; executable modes; shell/link/PATH/derived-env/dotenv policy; refuse unexpected shim-local Node. |
| `trace.mjs` | Historical shell→PATH Node→compiled Bun→Docker chain; raw PID/PPID/start-time/exe/cmdline; exact request argv; controlled old/remove/new IDs and attributed raw create/exec response bytes. |
| `drain.mjs` | Exact shim spawn with sealed env; bounded output; close-not-exit capture and owned-child cancellation; separate current descendant/PID absence, terminal daemon exec/jobs, and all-backend absence checks. |

`initial` remains a private immutable object graph with privately owned byte copies;
Buffer storage is not falsely described as frozen. Results make fresh copies and
expose no private record/Buffer. Ordinary guards were not changed. Between prefix
and baseline operations, source/seed/config/full original baseline and nonsecret
metadata remain pinned; the staged link may legitimately differ between operations.
The pre-reset applied inventory is the prior accepted operation's inventory, not
incorrectly assumed to be ordinary baseline again before restoration.

A signal/nonzero/error never returns successful completion. Recovery must use the
same closed owned child, newly validate historical attribution and independently
reobserve all current authority/drain/candidate/source facts. Failed drain attempts
do not consume the recovery handle. Successful recovery consumes it once but does
not turn the failed reset into successful case evidence; the caller retains its
original failure. Missing/unprovable recreation attribution fails closed rather
than adopting a same-name container or fabricating a passing recovery receipt.

## Deliberate native boundary limits

`process.nativeBinding` and raw observation functions are explicit, independently
trusted injected ports, not fields accepted from the reset request. These modules
validate their facts; they do not authenticate the producer by checking a DTO flag.
There is no default filesystem/process adapter, real tracing/proxy facade,
environment adoption, Docker/DB connection, CLI registration or native execution.

The bound unit profile uses its explicit underlying Unix daemon endpoint and the
actual fixed S11 shim request. This does not establish a future causal proxy's
endpoint mapping, authentic OS exec-history capture, native file/FD survival,
same-owner process tracing, daemon API attribution, or real backend absence.
Such a facade still requires separate TEST-first authority and actual locked host
evidence. Status0, labels, epochs, hashes and same OID are never native provenance.
Current accepted traces are deliberately the closed three-command minimal profile;
unmodelled/partial traces cannot authorize automatic recovery.

## Verification boundary and handoff

Author used absolute `apply_patch` only for writes, plus read-only filesystem/text
and SHA256 analysis. No parser, formatter, module import, test, runtime subprocess,
DB, Docker, network or Git operation was run by this author. No native reset or
genuine migration/rollback proof is claimed. Root's earlier normal-format preview
was below300 lines for every module; final normalization remains root-owned.

Next: root normalizes these seven modules, checks normalized limits, runs frozen104
contracts and scoped lint, obtains independent source review, then reports any
actual behavioral failure before a separate correction claim. Real native facade
and native negative/positive/restoration proof remain unreleased.

## Source freeze manifest — pre-root normalization

SHA256 covers full authored bytes, including final LF. Report self-hash is sent in
the external freeze message to avoid a self-referential manifest.

| Module | LF lines | SHA256 |
| --- | ---: | --- |
| `reset.mjs` |115| `31e4d4740fcafea38fca8fcfa70503d590291cdac90b1824af0c2e4c80e5522a` |
| `request.mjs` |113| `9dd488ead664c03bf7e648c7e229fd173a5fc6501ec79f82dc178f2c4817e7af` |
| `boundary.mjs` |67| `b5e97a63401ea23b36ed098130a6032c60ccbff30e3e1f86319ae73a503584e2` |
| `source.mjs` |104| `c661b6928c6c71c0c3e130fae53c7b13ae354125079067fcdc4dde4eb7e08e5a` |
| `executables.mjs` |101| `8e517dadd19ab5fb42d7da566b0be1d7c768d1abdb597036ccda3b44fb2693de` |
| `trace.mjs` |129| `fbbaab81860469124005863f1cdc6866ae174552e01bbb7a4111e923f44861a7` |
| `drain.mjs` |124| `4aa9f27f50e6f10ce2db2f8a216e6d18e121d41bb3fa504ab21d0528b761b730` |

Readback confirmed the frozen host test hashes unchanged:

- `host-renewal.test.ts`: `1af423611ff6c74eee88091ba8111428592bf31642b346dfe47827a6f8b245dc`
- `host-renewal-fixtures.ts`: `042912266ca4b73582ab37e54d31c2063e8b12a2ac1706e29df476656b0b2d59`
- `host-launcher-fixtures.ts`: `2fbb8c44f659698da8764108f938f7a058fc185a0e1fc5096f68ad737941e9ae`

TDD/contract-first kept the preexisting RED contracts frozen and execution with
root; clean-code/minimalist guidance drove the seven one-responsibility modules,
helper reuse, and no existing-file refactor or new dependency.
