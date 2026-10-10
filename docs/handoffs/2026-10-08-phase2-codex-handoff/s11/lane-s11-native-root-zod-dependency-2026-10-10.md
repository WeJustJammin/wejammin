# Slice11 real-API root Zod dependency amendment

## Frozen scope and observed harness failure

After AC057 fixture correction, root full db:verify passes333files12764 SQL
assertions; API30failed34passed files/10failed608passed172skipped tests.
Six suites cannot load package zod imported by root-owned
tests/postgrest/support/phase-02-slice-11-read-support.ts7.
Actual log: parent-s11-queued-ac057-db-verify-validate-v2-20261010.log,
first missing-package failure line5235. This is a harness loader failure,
not functional acceptance RED and not proof of subsequent assertions.

Read support13–22 uses strictObject/string regex/uuid for bounded independent
signed-cursor oracle. Keep it byte-identical, including every test/schema.
packages/contracts/package.json18 already pins zod4.4.3. Root package.json
does not declare zod; pnpm strict dependency resolution correctly rejects
the undeclared root import. Declare the existing same version at the root,
not an alias/hoist/config bypass, package export change or schema rewrite.

## Native author claim

Only package.json, one devDependencies entry `"zod": "4.4.3"`.
Keep all scripts, existing versions/config and source/QA byte-identical.
No commands, formatting, install, lockfile edits, DB/tests/network, Git,
memory, docs, grants/accounts/deployments. Root owns pnpm mechanical lockfile
update/install, exact-change review, loader/functional follow-up and full gates.
Wait for clean pushed exact-origin checkpoint before editing; release after
one minimal patch/report. No test titles changed.

Root6.1ultra orchestration/review; native6astrahigh author. No acceptance
claim, no root dependency proof until installed and targeted suites execute.
