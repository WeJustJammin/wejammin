#!/usr/bin/env bash
# Mutation checks of supabase/tests/phase_02_slice_11_rpc_review_assign_event_delivery.sql (P2-S11-AC-071).
# Each mutation edits ONE migration in the worktree, runs the alt-stack runner (reset + pg_prove), keeps the
# log, restores the migration from a byte copy and proves `git diff` is empty for it.  Run on a quiet host with
# no other lane resetting from this worktree.
set -uo pipefail
ROOT=/home/rob/.codex/worktrees/phase2-slice11/WeJammin
OUT="$ROOT/docs/handoffs/2026-10-10-claude-s11/lane-last-gaps-logs"
TEST=supabase/tests/phase_02_slice_11_rpc_review_assign_event_delivery.sql
cd "$ROOT" || exit 4

mutate() { # name file python-edit
  local name="$1" file="$2" edit="$3" backup
  backup=$(mktemp)
  cp "$file" "$backup"
  python3 - "$file" "$edit" <<'PY'
import sys
path, edit = sys.argv[1], sys.argv[2]
old, new = edit.split('\x1f')
text = open(path, encoding='utf-8').read()
assert text.count(old) == 1, f'{path}: pattern occurs {text.count(old)} times'
open(path, 'w', encoding='utf-8').write(text.replace(old, new))
PY
  local rc=$?
  if [ $rc -ne 0 ]; then cp "$backup" "$file"; echo "[$name] MUTATION NOT APPLIED"; return 1; fi
  bash docs/handoffs/2026-10-10-claude-s11/lanes/lane-db-alt.sh "$ROOT" "$TEST" > "$OUT/ac071-mutation-$name.log" 2>&1
  echo "runner-exit=$?" >> "$OUT/ac071-mutation-$name.log"
  cp "$backup" "$file"; rm -f "$backup"
  if git diff --quiet -- "$file"; then echo "[$name] restored, git diff empty"; else echo "[$name] RESTORE FAILED: $file"; fi
  echo "[$name] failing assertions:"; grep -E '^not ok' "$OUT/ac071-mutation-$name.log" | cut -c1-140
}

US=$'\x1f'
mutate m6b-context-kept-in-hash supabase/migrations/20260930150000_cms_idempotency_business_hash.sql \
"pg_catalog.jsonb_typeof(p_request->'context') = 'object' then${US}pg_catalog.jsonb_typeof(p_request->'context') = 'object' and false then"
mutate m9-completion-ignores-lease-token supabase/migrations/20260830100000_persistence_authority.sql \
"  where id = p_event_id and dispatched_at is null and dead_lettered_at is null and dispatch_lease_token = p_lease_token
    and dispatch_lease_until > clock_timestamp();
  get diagnostics affected = row_count;
  return affected = 1;
end;
\$\$;

create function platform_private.dead_letter_unknown_outbox_event${US}  where id = p_event_id and dispatched_at is null and dead_lettered_at is null and dispatch_lease_until > clock_timestamp();
  get diagnostics affected = row_count;
  return affected = 1;
end;
\$\$;

create function platform_private.dead_letter_unknown_outbox_event"
echo done
