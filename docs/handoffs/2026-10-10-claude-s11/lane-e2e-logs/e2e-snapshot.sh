#!/usr/bin/env bash
# Lane "e2e": refresh the verification snapshot from the worktree.
#
# Other lanes edit the worktree (SQL, workers) while a browser suite runs for tens of minutes, so every run of this lane
# executes from a copy. The copy keeps its own node_modules and the build caches (.astro, .wrangler, dist). A tree-state file records HEAD, the worktree's uncommitted file list and a checksum of every file this
# lane owns, so the report can name exactly what ran.
set -uo pipefail
WT=/home/rob/.codex/worktrees/phase2-slice11/WeJammin
SNAP=/home/rob/.codex/worktrees/phase2-slice11/lane-e2e-snap
OUT="$WT/docs/handoffs/2026-10-10-claude-s11/lane-e2e-logs"
TAG="${1:?usage: e2e-snapshot.sh <tag>}"

# The snapshot is the COMMITTED tree plus the files this lane owns. Other lanes (SQL, workers) leave half-edited work in
# the worktree while a browser suite runs, and a run that mixed that in would test nobody's code. The commit is exported
# first, then mirrored into the snapshot, then this lane's files are overlaid from the worktree.
EXPORT=/home/rob/.codex/worktrees/phase2-slice11/lane-e2e-export
rm -rf "$EXPORT" && mkdir -p "$EXPORT" || exit 1
git -C "$WT" archive --format=tar HEAD | tar -x -C "$EXPORT" || { echo "git archive failed"; exit 1; }
rsync -a --delete \
  --exclude=/node_modules --exclude=/.git --exclude=/test-results --exclude=/.lane-logs \
  --exclude=dist --exclude=.astro --exclude=.wrangler --exclude='*.tsbuildinfo' \
  "$EXPORT/" "$SNAP/" || { echo "rsync failed"; exit 1; }
rm -rf "$EXPORT"

OWNED=(
  tests/e2e/phase-02-slice-10-entry-list-real-route.spec.ts
  tests/e2e/phase-02-slice-11-workflow-real-route.spec.ts
  tests/e2e/support/s11-real-world.ts
  tests/e2e/support/s11-dst-gap.ts
  tests/e2e/support/s11-status-recorder.ts
  tests/e2e/support/s11-dst-gap.test.ts
  tests/e2e/support/README.md
  apps/worker/src/cms-editorial/a11y-structural/max-input.test.ts
)
# Overlay: modified or new files of this lane (the owned list), copied from the worktree.
for f in "${OWNED[@]}"; do
  mkdir -p "$(dirname "$SNAP/$f")" && cp "$WT/$f" "$SNAP/$f"
done
{
  echo "HEAD $(git -C "$WT" rev-parse HEAD)"
  echo "snapshot taken $(date -Is)"
  echo "-- worktree uncommitted files at snapshot time (git status --porcelain)"
  git -C "$WT" status --porcelain
  echo "-- sha256 of the files this lane owns, worktree vs snapshot"
  for f in "${OWNED[@]}"; do
    a=$(sha256sum "$WT/$f" | cut -c1-16)
    b=$(sha256sum "$SNAP/$f" | cut -c1-16)
    printf '%s  %s  %s\n' "$a" "$([ "$a" = "$b" ] && echo same || echo DIFFERENT)" "$f"
  done
} >"$OUT/$TAG-tree-state.txt"
cat "$OUT/$TAG-tree-state.txt"
