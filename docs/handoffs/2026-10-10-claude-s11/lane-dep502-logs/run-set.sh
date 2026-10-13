#!/usr/bin/env bash
# Usage: run-set.sh <log-name>  -- runs the dep502 affected vitest set under the quiet lock.
set -u
cd /home/rob/.codex/worktrees/phase2-slice11/WeJammin || exit 9
export PATH="/home/rob/.local/share/wejammin-toolchain/bin:$PATH"
LOG="docs/handoffs/2026-10-10-claude-s11/lane-dep502-logs/$1.log"
FILES=(
  packages/contracts/src/cms-editorial/routes.test.ts
  packages/contracts/src/cms-editorial/routes-slice11.test.ts
  packages/contracts/src/cms-editorial/routes-workflow.test.ts
  packages/contracts/src/cms-editorial/supplemental-routes.test.ts
  packages/contracts/src/cms-editorial/routes-dependency-code.test.ts
  apps/worker/src/cms-editorial/route-errors-dependency.test.ts
  apps/worker/src/cms-editorial/route-errors.test.ts
  apps/worker/src/cms-editorial/workflow-errors-typed.test.ts
  apps/worker/src/cms-editorial/workflow-read-routes.test.ts
  apps/worker/src/cms-editorial/workflow-read-breach
  apps/worker/src/cms-editorial/conflict-detail-routes.test.ts
  apps/worker/src/cms-editorial/detail-routes.test.ts
  apps/worker/src/cms-editorial/list-routes.test.ts
  apps/worker/src/cms-editorial/authoring-context-routes.test.ts
  apps/worker/src/cms-editorial/restore-production.test.ts
  apps/worker/src/cms-editorial/routes-admission.test.ts
  apps/worker/src/cms-editorial/workflow-command-operations.test.ts
  apps/worker/src/cms-editorial/workflow-command-quota.test.ts
  apps/worker/src/cms-editorial-production
  apps/worker/src/cms-composition-production
  apps/web/src/components/cms-editorial/cms-editorial-entry-create-transport.test.ts
  apps/web/src/components/cms-editorial/cms-editorial-runtime.test.ts
  apps/web/src/components/cms-editorial/ev-ea-conflict-recovery.test.ts
  apps/web/src/components/cms-editorial-workflow/cms-workflow-command-transport.test.ts
  apps/web/src/server/cms-editorial-platform-error-relay.test.ts
  apps/web/src/server/cms-editorial-platform-outcome-unknown.test.ts
  apps/web/src/server/cms-editorial-platform-proxies.test.ts
  tests/integration/phase-02-slice-10-ev-ea-error-mapping.test.ts
  tests/contracts/phase-02-slice-11-dependency-unavailable-code.test.ts
  tests/contracts/phase-02-slice-11-editorial-registry-openapi.test.ts
  tests/contracts/phase-02-slice-11-runbook.test.ts
  apps/worker/src/cms-editorial/workflow-read-operations.test.ts
)
flock -s /tmp/wejammin-quiet.lock pnpm exec vitest run "${FILES[@]}" --reporter=default > "$LOG" 2>&1
echo "exit=$?" >> "$LOG"
