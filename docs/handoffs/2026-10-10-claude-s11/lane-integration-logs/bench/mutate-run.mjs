// Applies one mutation to the installed invalidation core (disposable database only), then runs the race runner.
import * as kit from '/home/rob/.codex/worktrees/phase2-slice11/WeJammin/infra/database-races/race-kit.mjs';

const which = process.argv[2];
const edits = {
  // the review row is no longer locked FOR UPDATE: two runs are not serialized
  nolock: ["     for update;\n  if not found then", "  ;\n  if not found then"],
  // a review that is no longer live is no longer an idempotent no-op: the second run updates it again
  noguard: ["if review_row.state not in ('open', 'approved') then", 'if false then'],
};
const [from, to] = edits[which];
kit.runScript(`
do $do$
declare def text := pg_catalog.pg_get_functiondef('platform_private.cms_invalidate_editorial_review(jsonb)'::regprocedure);
begin
  if position($m$${from}$m$ in def) = 0 then raise exception 'mutation anchor not found'; end if;
  def := replace(def, $m$${from}$m$, $m$${to}$m$);
  execute def;
end
$do$;
select '{}';
`);
console.log(`# mutation ${which} applied to platform_private.cms_invalidate_editorial_review`);
await import('/home/rob/.codex/worktrees/phase2-slice11/WeJammin/supabase/tests/phase_02_slice_11_races/031-dependency-recheck-race.mjs');
