/**
 * DIAGNOSTIC ONLY (lane S11-4R). Never part of green evidence.
 *
 * With `S11_DIAG_OVERLAY=1` the world preparation rewrites, in the already-reset database, the
 * one statement that PostgREST's `safeupdate` (session_preload_libraries of `authenticator`)
 * refuses: `delete from pg_temp.cms_manifest_block_refs;` in
 * `platform_private.cms_build_dependency_manifest` (20261005017560, NOTES 2026-10-08 20:25).
 * It lets a run surface the defects BEHIND that blocker. It is a no-op once the migration is
 * fixed (nothing matches), and this module is deleted when that fix lands.
 */
import { psql } from './stack';

export const applyDiagnosticOverlay = (): number => {
  if (process.env.S11_DIAG_OVERLAY !== '1') return 0;
  const patched = psql(`
    do $overlay$
    declare
      target record;
      definition text;
      patched integer := 0;
    begin
      for target in
        select p.oid, n.nspname, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where p.prosrc like '%delete from pg_temp.cms_manifest_block_refs;%'
      loop
        definition := replace(pg_get_functiondef(target.oid),
          'delete from pg_temp.cms_manifest_block_refs;',
          'delete from pg_temp.cms_manifest_block_refs where true;');
        execute definition;
        patched := patched + 1;
      end loop;
      create temp table if not exists overlay_result(n integer);
      insert into overlay_result values (patched);
    end
    $overlay$;
    select n from overlay_result;`);
  return Number(patched.split('\n').at(-1) ?? 0);
};
