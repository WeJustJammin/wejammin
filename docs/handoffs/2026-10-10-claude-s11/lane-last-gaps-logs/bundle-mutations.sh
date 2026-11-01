#!/usr/bin/env bash
# Mutation checks of tests/e2e/phase-02-slice-11-bundle-budget-real-route.spec.ts (P2-S11-AC-106).
# Each mutation edits ONE file, runs the real-route spec through lane-e2e.sh (reset + build + serve +
# Chrome) and restores the file from a byte copy, proving `git diff`/`cmp` shows no change.
set -uo pipefail
ROOT=/home/rob/.codex/worktrees/phase2-slice11/WeJammin
OUT="$ROOT/docs/handoffs/2026-10-10-claude-s11/lane-last-gaps-logs"
SPEC=tests/e2e/phase-02-slice-11-bundle-budget-real-route.spec.ts
cd "$ROOT" || exit 4

run() { # name
  flock -s /tmp/wejammin-quiet.lock bash docs/handoffs/2026-10-08-phase2-codex-handoff/lanes/lane-e2e.sh "$ROOT" \
    pnpm exec playwright test --config=playwright.s09-real.config.ts "$SPEC" > "$OUT/bundle-mutation-$1.log" 2>&1
  echo "runner-exit=$?" >> "$OUT/bundle-mutation-$1.log"
  grep -E "✓|✘|passed|failed|Error:|Expected|Received|stays within|fetches" "$OUT/bundle-mutation-$1.log" | cut -c1-260 | head -14
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
  cp "$backup" "$file"; rm -f "$backup"
  if git diff --quiet -- "$file" 2>/dev/null || [ -z "$(git status --short -- "$file")" ]; then echo "[$name] restored"; else echo "[$name] file differs from HEAD (new file or edit) - compare manually: $file"; fi
}

# P1: lower the asserted lazy-chunk threshold below the chunk (20 KiB < ~27 KB gzip).
cp "$SPEC" "$OUT/.spec-before-p1"
mutate p1-threshold-20kib "$SPEC" \
  "const threshold = BUNDLE_BUDGETS.lazyChunkGzipBytes;" \
  "const threshold = 20 * 1024;"
cmp "$SPEC" "$OUT/.spec-before-p1" && echo "[p1] spec byte-identical after restore"; rm -f "$OUT/.spec-before-p1"

# P2: import the Time authority statically: its snapshot travels with the island, not behind the form.
mutate p2-static-time-authority apps/web/src/components/cms-editorial-workflow/use-cms-schedule-time.ts \
"import type { TimeAuthority } from '@wejammin/contracts/time-authority';
" \
"import type { TimeAuthority } from '@wejammin/contracts/time-authority';
import * as staticTimeAuthority from '@wejammin/contracts/time-authority';
" \
"  (
    await import('@wejammin/contracts/time-authority')
  ).loadPinnedTimeAuthority();" \
"  staticTimeAuthority.loadPinnedTimeAuthority();"
echo done
