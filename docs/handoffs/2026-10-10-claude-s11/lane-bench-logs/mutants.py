# Generates mutants of the installed cms_create_type_draft for the parity suite (mutation proof).
# Each mutant file is the parity test with a DO block that rewrites the installed function inside the test
# transaction (rolled back at the end).  Usage: python3 mutants.py <out-dir>
import sys
OUT = sys.argv[1].rstrip('/') + '/'
src = open('/home/rob/.codex/worktrees/phase2-slice11/WeJammin/supabase/tests/phase_02_slice_09_create_draft_parity.sql').read()
src = (src.replace('\\ir support/', '\\ir /w/supabase/tests/support/')
          .replace('\\ir phase_02_slice_09_dec108/', '\\ir /w/supabase/tests/phase_02_slice_09_dec108/')
          .replace('\\ir phase_02_slice_09_create_draft_parity/', '\\ir /w/supabase/tests/phase_02_slice_09_create_draft_parity/'))
def lit(s): return "E'" + s.replace('\\', '\\\\').replace("'", "''").replace('\n', '\\n') + "'"
mutants = {
 'm1_hash_version': ("'compilerVersion', '1',\n    'zodContractRef', contract_ref,\n    'editorManifest', editor_manifest || pg_catalog.jsonb_build_object(", "'compilerVersion', '2',\n    'zodContractRef', contract_ref,\n    'editorManifest', editor_manifest || pg_catalog.jsonb_build_object("),
 'm2_fallback_hash': ("      'compilerVersion', '1',\n      'zodContractRef', contract_ref,\n      'editorManifest', editor_manifest,", "      'compilerVersion', '2',\n      'zodContractRef', contract_ref,\n      'editorManifest', editor_manifest,"),
 'm3_no_validators': ("else pg_catalog.jsonb_build_object('validators', protected_validators)", "else '{}'::jsonb"),
 'm4_renderer_capabilities': ("    'capabilityBindings', canonical_definition->'capabilityBindings'\n  );", "    'capabilityBindings', '[]'::jsonb\n  );"),
 'm5_validate_first': ("  canonical_definition := platform_private.cms_canonical_type_definition(p_request);", "  if exists (select 1 from pg_catalog.jsonb_array_elements(p_request->'fields') f(value) where not platform_private.cms_valid_field_input(f.value, true)) then raise exception 'VALIDATION_FAILED' using errcode = 'P0001'; end if;\n  canonical_definition := platform_private.cms_canonical_type_definition(p_request);"),
 'm6_event_type': ("'cms.schema.draft.created.v1'", "'cms.schema.draft.created.v2'"),
 'm7_contract_ref': ("    contract_ref, editor_manifest, renderer_manifest, definition_hash, now()", "    contract_ref || 'x', editor_manifest, renderer_manifest, definition_hash, now()"),
 # m8: the slot-count guard is ignored, the splice is always taken: only the slot_collision case (slot text in the label) must fail.
 'm8_splice_always_taken': ("= 2 * pg_catalog.length(fields_slot::text) then", "<> 99 * pg_catalog.length(fields_slot::text) then"),
 # m9: the guard never passes, the direct serialisation is always taken: an EQUIVALENT mutant (the suite must stay green),
 # which shows that the splice path and the direct path hash the same document.
 'm9_direct_path_always_equivalent': ("= 2 * pg_catalog.length(fields_slot::text) then", "= 99 * pg_catalog.length(fields_slot::text) then"),
 'm10_dropped_field': ("  from pg_catalog.jsonb_array_elements(p_request->'fields') field_entry(value);\n  for relation_input", "  from pg_catalog.jsonb_array_elements(p_request->'fields') field_entry(value) where field_entry.value->>'key' <> 'f002';\n  for relation_input"),
}
for name, (old, new) in mutants.items():
    block = f"""
do $mutant$
declare def text := pg_get_functiondef('platform_private.cms_create_type_draft(jsonb)'::regprocedure);
begin
  if position({lit(old)} in def) = 0 then raise exception 'mutant anchor not found'; end if;
  def := replace(def, {lit(old)}, {lit(new)});
  execute def;
end
$mutant$;
"""
    open(OUT + name + '.sql', 'w').write(src.replace("select no_plan();\n", "select no_plan();\n" + block, 1))
print(' '.join(mutants))
