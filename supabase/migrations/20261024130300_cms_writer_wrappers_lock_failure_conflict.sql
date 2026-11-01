-- Slice 12 gap lane claude_s12_gaps_db2 (P2-S12-AC-276, BE03c "Slice 12 lock order" rule 4, BE03b rule 6): "`deadlock_detected` and a
-- lock-acquisition failure at a lock step are converted to the 409 code of the operation's catalog with nothing committed".  The Slice 12
-- writer wrappers of CMS-03C-02 .. -19 do both; these eight wrappers do not:
--   * platform_api.cms_define_template (CMS-03C-01) converts neither, at the same-key ADVISORY lock before the body nor inside the
--     private body: a deadlock or lock timeout surfaces as a raw 40P01 / 55P03 (root decision 2026-10-27: both are the retryable CONFLICT;
--     phase_02_slice_12_template_authority.sql #36 is corrected to observe the wait through that outcome);
--   * platform_api.cms_create_revision, cms_resolve_conflict and cms_restore_revision (the revision-append, conflict-resolution and
--     restore carry-over writers) and, since review V13-02, cms_create_entry (which Slice 12 amended with the DEC-202 default-template
--     FOR SHARE), cms_activate_schema, cms_activate_schema_migration and cms_revoke_capability_grant convert deadlock_detected only
--     (20261005013100), so a lock_not_available surfaces raw.  None of these four has an advisory wait: the lock steps all sit inside the
--     private body, so the one handler is the whole conversion.  The existing deadlock handler is kept byte for byte
--     (phase_02_slice_10_activation_lock_order.sql #26 matches its text) and a second handler is added.  57014 (statement timeout) is
--     deliberately NOT converted (DEC-221).
-- Debug-by-test: supabase/tests/phase_02_slice_12_gaps_lock_conversion.sql is RED against the promoted migrations and GREEN with this one.
-- Each amendment is a guarded anchored replacement of the LIVE source (every anchor exactly once; the INVERSE replacement is computed and
-- must restore the installed source byte for byte; every pg_proc attribute except the source unchanged).  Forward-only; idempotent (the
-- marker lock_not_available).
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $migration$
declare
  item record;
  original pg_catalog.pg_proc%rowtype;
  actual pg_catalog.pg_proc%rowtype;
  old_source text;
  new_source text;
  inverse_source text;
  definition text;
  comment_text text;
  i integer;
  anchors_old text[];
  anchors_new text[];
begin
  for item in select * from (values
    ('platform_api.cms_define_template(jsonb)',
      array[E'    perform pg_catalog.pg_advisory_xact_lock(\n      pg_catalog.hashtextextended(\'cms.template:\' || template_key, 0)\n    );',
            E'  rpc_result := platform_private.cms_define_template(p_request);'],
      array[E'    begin\n      perform pg_catalog.pg_advisory_xact_lock(\n        pg_catalog.hashtextextended(\'cms.template:\' || template_key, 0)\n      );\n    exception\n      when deadlock_detected or lock_not_available then\n        raise exception \'CONFLICT\' using errcode = \'P0001\';\n    end;',
            E'  begin\n    rpc_result := platform_private.cms_define_template(p_request);\n  exception\n    when deadlock_detected or lock_not_available then\n      raise exception \'CONFLICT\' using errcode = \'P0001\';\n  end;']),
    ('platform_api.cms_create_revision(jsonb)', array[E'    when deadlock_detected then\n      raise exception \'CONFLICT\' using errcode = \'P0001\';'], array[E'    when deadlock_detected then\n      raise exception \'CONFLICT\' using errcode = \'P0001\';\n    when lock_not_available then\n      raise exception \'CONFLICT\' using errcode = \'P0001\';']),
    ('platform_api.cms_resolve_conflict(jsonb)', array[E'    when deadlock_detected then\n      raise exception \'CONFLICT\' using errcode = \'P0001\';'], array[E'    when deadlock_detected then\n      raise exception \'CONFLICT\' using errcode = \'P0001\';\n    when lock_not_available then\n      raise exception \'CONFLICT\' using errcode = \'P0001\';']),
    ('platform_api.cms_restore_revision(jsonb)', array[E'    when deadlock_detected then\n      raise exception \'CONFLICT\' using errcode = \'P0001\';'], array[E'    when deadlock_detected then\n      raise exception \'CONFLICT\' using errcode = \'P0001\';\n    when lock_not_available then\n      raise exception \'CONFLICT\' using errcode = \'P0001\';']),
    ('platform_api.cms_create_entry(jsonb)', array[E'    when deadlock_detected then\n      raise exception \'CONFLICT\' using errcode = \'P0001\';'], array[E'    when deadlock_detected then\n      raise exception \'CONFLICT\' using errcode = \'P0001\';\n    when lock_not_available then\n      raise exception \'CONFLICT\' using errcode = \'P0001\';']),
    ('platform_api.cms_activate_schema(jsonb)', array[E'    when deadlock_detected then\n      raise exception \'CONFLICT\' using errcode = \'P0001\';'], array[E'    when deadlock_detected then\n      raise exception \'CONFLICT\' using errcode = \'P0001\';\n    when lock_not_available then\n      raise exception \'CONFLICT\' using errcode = \'P0001\';']),
    ('platform_api.cms_activate_schema_migration(jsonb)', array[E'    when deadlock_detected then\n      raise exception \'CONFLICT\' using errcode = \'P0001\';'], array[E'    when deadlock_detected then\n      raise exception \'CONFLICT\' using errcode = \'P0001\';\n    when lock_not_available then\n      raise exception \'CONFLICT\' using errcode = \'P0001\';']),
    ('platform_api.cms_revoke_capability_grant(jsonb)', array[E'    when deadlock_detected then\n      raise exception \'CONFLICT\' using errcode = \'P0001\';'], array[E'    when deadlock_detected then\n      raise exception \'CONFLICT\' using errcode = \'P0001\';\n    when lock_not_available then\n      raise exception \'CONFLICT\' using errcode = \'P0001\';'])
  ) as target(identity, old_anchors, new_anchors)
  loop
    select proc.* into original from pg_catalog.pg_proc proc where proc.oid = pg_catalog.to_regprocedure(item.identity);
    if not found then
      raise exception 'wrapper missing: %', item.identity using errcode = '55000';
    end if;
    old_source := original.prosrc;
    if pg_catalog.strpos(old_source, 'lock_not_available') > 0 then
      continue;
    end if;
    comment_text := pg_catalog.obj_description(original.oid, 'pg_proc');
    if not original.prosecdef or original.prokind <> 'f' or original.proconfig is distinct from array['search_path=""']::text[] then
      raise exception 'wrapper: unexpected attributes of %', item.identity using errcode = '55000';
    end if;
    anchors_old := item.old_anchors;
    anchors_new := item.new_anchors;
    new_source := old_source;
    for i in 1 .. pg_catalog.cardinality(anchors_old) loop
      if (pg_catalog.length(new_source) - pg_catalog.length(pg_catalog.replace(new_source, anchors_old[i], ''))) / pg_catalog.length(anchors_old[i]) <> 1 then
        raise exception 'wrapper: unexpected anchor % in %', i, item.identity using errcode = '55000';
      end if;
      new_source := pg_catalog.replace(new_source, anchors_old[i], anchors_new[i]);
    end loop;
    inverse_source := new_source;
    for i in reverse pg_catalog.cardinality(anchors_new) .. 1 loop
      inverse_source := pg_catalog.replace(inverse_source, anchors_new[i], anchors_old[i]);
    end loop;
    if inverse_source is distinct from old_source then
      raise exception 'wrapper: non-anchored change in %', item.identity using errcode = '55000';
    end if;
    definition := pg_catalog.pg_get_functiondef(original.oid);
    if (pg_catalog.length(definition) - pg_catalog.length(pg_catalog.replace(definition, old_source, ''))) / pg_catalog.length(old_source) <> 1 then
      raise exception 'wrapper: ambiguous definition of %', item.identity using errcode = '55000';
    end if;
    execute pg_catalog.replace(definition, old_source, new_source);
    select proc.* into actual from pg_catalog.pg_proc proc where proc.oid = pg_catalog.to_regprocedure(item.identity);
    if not found or actual.oid <> original.oid or actual.prosrc <> new_source
       or pg_catalog.to_jsonb(actual) - 'prosrc' <> pg_catalog.to_jsonb(original) - 'prosrc'
       or pg_catalog.obj_description(actual.oid, 'pg_proc') is distinct from comment_text then
      raise exception 'wrapper: replacement changed more than the source of %', item.identity using errcode = '55000';
    end if;
  end loop;
end;
$migration$;

commit;
