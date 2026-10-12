#!/usr/bin/env bash
# Lane "a11y-status": a verification snapshot for the real-route browser run.
#   a11y-snapshot.sh red     HEAD's tree + the lane's SPEC only (the product is the pre-fix HEAD): the new spec assertions must fail
#   a11y-snapshot.sh green   HEAD's tree + the lane's spec and every product file of the fix
# The finisher lane keeps uncommitted worker/contract/SQL edits in the worktree while a browser suite runs for minutes, so a run
# mixing them in would test nobody's code: the snapshot is the COMMITTED tree plus this lane's files, never an rsync of the worktree.
set -uo pipefail
WT=/home/rob/.codex/worktrees/phase2-slice11/WeJammin
SNAP=/home/rob/.codex/worktrees/phase2-slice11/lane-a11y-snap
EXPORT=/home/rob/.codex/worktrees/phase2-slice11/lane-a11y-export
MODE="${1:?usage: a11y-snapshot.sh red|green}"
D=apps/web/src/components/cms-editorial-workflow
SPEC=tests/e2e/phase-02-slice-11-workflow-real-route.spec.ts
PRODUCT=(
  $D/CmsEditorialReviewDetailIsland.tsx
  $D/CmsEditorialWorkflowIsland.tsx
  $D/CmsWorkflowCommandFrame.tsx
  $D/CmsWorkflowRefusalAlert.tsx
  $D/CmsWorkflowStatusRegion.tsx
  $D/use-cms-workflow-status.ts
)
mkdir -p "$SNAP" || exit 1
# node_modules are copied once (symlinks kept); every later call leaves them alone.
for d in node_modules apps/docs/node_modules apps/web/node_modules apps/worker/node_modules packages/application/node_modules \
  packages/config/node_modules packages/contracts/node_modules packages/observability/node_modules packages/ui/node_modules; do
  if [ ! -e "$SNAP/$d" ]; then mkdir -p "$SNAP/$d" && rsync -a "$WT/$d/" "$SNAP/$d/" || { echo "node_modules copy failed: $d"; exit 1; }; fi
done
rm -rf "$EXPORT" && mkdir -p "$EXPORT" || exit 1
git -C "$WT" archive --format=tar HEAD | tar -x -C "$EXPORT" || { echo "git archive failed"; exit 1; }
rsync -a --delete \
  --exclude=node_modules --exclude=/.git --exclude=/test-results --exclude=/.lane-logs \
  --exclude=dist --exclude=.astro --exclude=.wrangler --exclude='*.tsbuildinfo' \
  "$EXPORT/" "$SNAP/" || { echo "rsync failed"; exit 1; }
rm -rf "$EXPORT"
cp "$WT/$SPEC" "$SNAP/$SPEC"
if [ "$MODE" = green ]; then
  for f in "${PRODUCT[@]}"; do cp "$WT/$f" "$SNAP/$f"; done
fi
{
  echo "mode $MODE"
  echo "HEAD $(git -C "$WT" rev-parse HEAD)"
  echo "snapshot taken $(date -Is)"
  echo "-- sha256 of the lane's files, worktree vs snapshot"
  for f in "$SPEC" "${PRODUCT[@]}"; do
    a=$(sha256sum "$WT/$f" | cut -c1-16)
    if [ -e "$SNAP/$f" ]; then b=$(sha256sum "$SNAP/$f" | cut -c1-16); else b=absent; fi
    printf '%s  %s  %s\n' "$a" "$([ "$a" = "$b" ] && echo same || echo DIFFERENT)" "$f"
  done
} | tee "/home/rob/.codex/worktrees/phase2-slice11/WeJammin/docs/handoffs/2026-10-10-claude-s11/lane-a11y-status-logs/snapshot-$MODE-tree-state.txt"
