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
mutate m1-late-completion supabase/migrations/20260830100000_persistence_authority.sql \
"  where id = p_event_id and dispatched_at is null and dead_lettered_at is null and dispatch_lease_token = p_lease_token
    and dispatch_lease_until > clock_timestamp();
  get diagnostics affected = row_count;
  return affected = 1;
end;
\$\$;

create function platform_private.dead_letter_unknown_outbox_event${US}  where id = p_event_id and dispatched_at is null and dead_lettered_at is null and dispatch_lease_token = p_lease_token;
  get diagnostics affected = row_count;
  return affected = 1;
end;
\$\$;

create function platform_private.dead_letter_unknown_outbox_event"
mutate m2-reopen supabase/migrations/20260830100000_persistence_authority.sql \
"  if old.dispatched_at is not null and new.dispatched_at is distinct from old.dispatched_at then
    raise exception 'dispatched outbox events cannot be reopened' using errcode = 'P0001';
  end if;${US}"
mutate m3-version-rewrite supabase/migrations/20260830100000_persistence_authority.sql \
"or new.aggregate_version is distinct from old.aggregate_version${US}"
mutate m4-replay-emits supabase/migrations/20261005017620_cms_assign_editorial_reviewer.sql \
"      return reservation.response_ref->'safeHeaders'->'response';
    end if;
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';${US}      perform platform_private.cms_emit_event(
        'cms.editorial.review.assignment.' || action, actor_id, acting_party_id,
        'cms_editorial_review', requested_review, 'CMS_EDITORIAL_REVIEW_ASSIGNMENT_CHANGED',
        'cms.entry.review-changed.v1', 'cms_editorial_review', requested_review, expected_version,
        pg_catalog.jsonb_build_object('reviewId', requested_review, 'revisionId', requested_review),
        correlation_id);
      return reservation.response_ref->'safeHeaders'->'response';
    end if;
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';"
mutate m5-relay-claims-family supabase/migrations/20261010164000_cms_review_recheck_relay.sql \
"          ('cms.localization.changed.v1', 'cms_content_entry'))${US}          ('cms.localization.changed.v1', 'cms_content_entry'),
          ('cms.entry.review-changed.v1', 'cms_editorial_review'))"
mutate m6-correlation-in-hash supabase/migrations/20260930150000_cms_idempotency_business_hash.sql \
"          - array['idempotencyKey', 'correlationId']::text[],
            '{context}'::text[],${US}          - array['idempotencyKey']::text[],
            '{context}'::text[],"
mutate m7-payload-rewrite supabase/migrations/20260830100000_persistence_authority.sql \
"     or new.payload is distinct from old.payload or new.occurred_at is distinct from old.occurred_at then${US}     or new.occurred_at is distinct from old.occurred_at then"
mutate m8-redelivery-regenerates-instant supabase/migrations/20260830100000_persistence_authority.sql \
"    raise exception 'outbox attempt count cannot decrease' using errcode = 'P0001';
  end if;
  return new;${US}    raise exception 'outbox attempt count cannot decrease' using errcode = 'P0001';
  end if;
  new.occurred_at := new.occurred_at + interval '1 microsecond';
  return new;"
echo done
