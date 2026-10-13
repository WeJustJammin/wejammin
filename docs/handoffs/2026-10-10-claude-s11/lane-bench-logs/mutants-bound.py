# Mutants of the installed cms_compiled_manifest_bounded for the manifest-bound equivalence suite (mutation proof).
# Usage: python3 mutants-bound.py <out-dir>
import sys
OUT = sys.argv[1].rstrip('/') + '/'
src = open('/home/rob/.codex/worktrees/phase2-slice11/WeJammin/supabase/tests/phase_02_slice_09_create_draft_parity_manifest_bound.sql').read()
src = src.replace('\\ir support/', '\\ir /w/supabase/tests/support/')
def lit(s): return "E'" + s.replace('\\', '\\\\').replace("'", "''").replace('\n', '\\n') + "'"
mutants = {
 'q1_depth_13': ("$.**{12}", "$.**{13}"),
 'q2_array_129': ("@.size() > 128", "@.size() > 129"),
 'q3_keys_129': (")) > 128", ")) > 129"),
 'q4_no_key_rule': ("or exists (", "or false and exists ("),
 'q5_bytes_off_by_one': ("> 524288", "> 524289"),
 'q6_scalar_false': ("then true", "then false"),
 'q7_no_array_rule': ("or pg_catalog.jsonb_path_exists(p_value,\n        'strict $.** ? (@.type() == \"array\"", "or false and pg_catalog.jsonb_path_exists(p_value,\n        'strict $.** ? (@.type() == \"array\""),
}
for name, (old, new) in mutants.items():
    block = f"""
do $mutant$
declare def text := pg_get_functiondef('platform_private.cms_compiled_manifest_bounded(jsonb)'::regprocedure);
begin
  if position({lit(old)} in def) = 0 then raise exception 'mutant anchor not found'; end if;
  def := replace(def, {lit(old)}, {lit(new)});
  execute def;
end
$mutant$;
"""
    open(OUT + name + '.sql', 'w').write(src.replace("select no_plan();\n", "select no_plan();\n" + block, 1))
print(' '.join(mutants))
