#!/usr/bin/env bash
# Second pass of the mutation checks of the route-budget assertion of tests/e2e/phase-02-slice-11-bundle-budget-real-route.spec.ts
# (P2-S11-AC-106). Each mutation edits ONE file, runs the real-route spec through lane-e2e.sh (reset + build + serve +
# Chrome) and restores the file from a byte copy, proving `cmp` shows no change.
set -uo pipefail
ROOT=/home/rob/.codex/worktrees/phase2-slice11/WeJammin
OUT="$ROOT/docs/handoffs/2026-10-10-claude-s11/lane-bundle-logs"
SPEC=tests/e2e/phase-02-slice-11-bundle-budget-real-route.spec.ts
cd "$ROOT" || exit 4
export PATH="/home/rob/.local/share/wejammin-toolchain/bin:$PATH"

run() { # name
  flock -s /tmp/wejammin-quiet.lock bash docs/handoffs/2026-10-08-phase2-codex-handoff/lanes/lane-e2e.sh "$ROOT" \
    pnpm exec playwright test --config=playwright.s09-real.config.ts "$SPEC" > "$OUT/bundle-mutation-$1.log" 2>&1
  echo "runner-exit=$?" >> "$OUT/bundle-mutation-$1.log"
  grep -E "✓|✘|passed|failed|Expected|Received|initial JavaScript|contract schema" "$OUT/bundle-mutation-$1.log" | cut -c1-260 | head -14
}

mutate() { # name file old new [old new ...]
  local name="$1" file="$2" backup
  shift 2
  backup=$(mktemp)
  cp "$file" "$backup"
  python3 - "$file" "$@" <<'PY'
import sys
path, pairs = sys.argv[1], sys.argv[2:]
text = open(path, encoding='utf-8').read()
for old, new in zip(pairs[0::2], pairs[1::2]):
    assert text.count(old) == 1, f'{path}: pattern occurs {text.count(old)} times'
    text = text.replace(old, new)
open(path, 'w', encoding='utf-8').write(text)
PY
  if [ $? -ne 0 ]; then cp "$backup" "$file"; echo "[$name] MUTATION NOT APPLIED"; return 1; fi
  echo "[$name]"
  run "$name"
  cp "$backup" "$file"
  cmp "$file" "$backup" && echo "[$name] file byte-identical after restore"
  rm -f "$backup"
}

# P3b: the form state module (loaded by every workflow form) statically imports the contract barrel AND calls a schema,
# so the build cannot tree-shake it (the first attempt, a `void` use, was dropped by the bundler and proved nothing).
mutate p3b-static-barrel-called-in-the-island apps/web/src/components/cms-editorial-workflow/cms-workflow-form-state.ts \
"import type { CommandState } from './cms-workflow-command-controller';" \
"import type { CommandState } from './cms-workflow-command-controller';
import { ApiErrorSchema } from '@wejammin/contracts';" \
"): boolean => disabledReason !== null || BLOCKING_PHASES.has(state.phase);" \
"): boolean =>
  ApiErrorSchema.safeParse(null).success ||
  disabledReason !== null ||
  BLOCKING_PHASES.has(state.phase);"
echo done
