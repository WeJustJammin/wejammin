#!/usr/bin/env bash
# CI browser and accessibility gates (`pnpm test:e2e`). The Slice 10 real-route
# specs run the built web app against the production editorial Worker,
# PostgREST and the newest SQL, so the local Supabase stack must be up and on
# this checkout's migrations. Both self-hosted runners share one stack on this
# host, so the run holds the same lock as infra/verify-database.sh and always
# stops the stack afterwards.

set -euo pipefail

lock_file="${WEJAMMIN_SUPABASE_CI_LOCK:-/tmp/wejammin-supabase-ci.lock}"

exec 9>"${lock_file}"
flock --wait 1800 9

cleanup() {
  pnpm db:stop >/dev/null 2>&1 || true
}

trap cleanup EXIT

pnpm db:stop >/dev/null 2>&1 || true
pnpm db:start
pnpm db:reset
pnpm test:e2e
