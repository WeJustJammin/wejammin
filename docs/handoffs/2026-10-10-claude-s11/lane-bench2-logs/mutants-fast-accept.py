#!/usr/bin/env python3
"""Mutation proof for supabase/migrations/20261010167000_cms_valid_field_input_fast_accept.sql.

Each mutant LOOSENS or breaks one condition of the early accept inside the installed function (in the test
transaction only: the test file is copied with a DO block that rewrites pg_get_functiondef text) and the suite
phase_02_slice_09_valid_field_input_fast_accept.sql is run on the alt stack.  A mutant is killed when the suite fails.
Usage: mutants-fast-accept.py [name ...]   (no names: all)
"""
import re, subprocess, sys, os
LANE = '/home/rob/.codex/worktrees/phase2-slice11/WeJammin'
SCRATCH = '/tmp/claude-1000/-home-rob-Projects-WeJammin/7aaa9e49-fdde-440a-9c62-f82994358a13/scratchpad/bench2-lane/mut'
LOGS = LANE + '/docs/handoffs/2026-10-10-claude-s11/lane-bench2-logs'
TEST = LANE + '/supabase/tests/phase_02_slice_09_valid_field_input_fast_accept.sql'
RUN = LANE + '/docs/handoffs/2026-10-10-claude-s11/lane-bench-logs/altrun.sh'

UUID = "(p_value->>'stableFieldId') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'"
MUTANTS = {
  'm01_no_uuid_check': (UUID, 'true'),
  'm02_uuid_version_nibble': ("[1-8][0-9a-f]{3}-[89ab]", "[0-8][0-9a-f]{3}-[89ab]"),
  'm03_uuid_variant_nibble': ("-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'\n       and pg_catalog.jsonb_typeof(p_value->'key')", "-[89abc][0-9a-f]{3}-[0-9a-f]{12}$'\n       and pg_catalog.jsonb_typeof(p_value->'key')"),
  'm04_no_reserved_check': ("and not (pg_catalog.lower(p_value->>'key') = any (array[", "and not (false and pg_catalog.lower(p_value->>'key') = any (array["),
  'm05_reserved_case_sensitive': ("pg_catalog.lower(p_value->>'key') = any (array[", "(p_value->>'key') = any (array["),
  'm06_one_reserved_word_missing': ("'user', 'users', 'person'", "'usex', 'users', 'person'"),
  'm07_key_min_length': ("'^[a-z][a-z0-9_]{1,63}$'\n       and not (pg_catalog.lower", "'^[a-z][a-z0-9_]{0,63}$'\n       and not (pg_catalog.lower"),
  'm08_key_max_length': ("'^[a-z][a-z0-9_]{1,63}$'\n       and not (pg_catalog.lower", "'^[a-z][a-z0-9_]{1,64}$'\n       and not (pg_catalog.lower"),
  'm09_kind_list': ("'relation','media']::pg_catalog.text[])\n       and pg_catalog.jsonb_typeof(constraints)", "'relation','media','list']::pg_catalog.text[])\n       and pg_catalog.jsonb_typeof(constraints)"),
  'm10_kind_object': ("'relation','media']::pg_catalog.text[])\n       and pg_catalog.jsonb_typeof(constraints)", "'relation','media','object']::pg_catalog.text[])\n       and pg_catalog.jsonb_typeof(constraints)"),
  'm11_kind_any_string': ("and (p_value->>'kind') = any (array['short_text'", "and (p_value->>'kind') is not null or (p_value->>'kind') = any (array['short_text'"),
  'm12_constraint_key_enum': ("array['minLength','maxLength','minimum','maximum']::pg_catalog.text[]) = '{}'", "array['minLength','maxLength','minimum','maximum','enumValues']::pg_catalog.text[]) = '{}'"),
  'm13_constraint_key_item_kind': ("array['minLength','maxLength','minimum','maximum']::pg_catalog.text[]) = '{}'", "array['minLength','maxLength','minimum','maximum','itemKind']::pg_catalog.text[]) = '{}'"),
  'm14_constraint_bytes': ("octet_length(constraints::pg_catalog.text) <= 8192", "octet_length(constraints::pg_catalog.text) <= 20000"),
  'm15_minlength_digits': ("(constraints->>'minLength') ~ '^([0-9]{1,5}|100000)$'", "(constraints->>'minLength') ~ '^([0-9]{1,6})$'"),
  'm16_maxlength_digits': ("(constraints->>'maxLength') ~ '^([0-9]{1,5}|100000)$'", "(constraints->>'maxLength') ~ '^([0-9]{1,6})$'"),
  'm17_maxlength_type': ("pg_catalog.jsonb_typeof(constraints->'maxLength') = 'number' and", "true and"),
  'm18_min_le_max_length': ("or constraints->'minLength' <= constraints->'maxLength')", "or true)"),
  'm19_min_le_max_value': ("or constraints->'minimum' <= constraints->'maximum')", "or true)"),
  'm20_minimum_type': ("(not (constraints ? 'minimum') or pg_catalog.jsonb_typeof(constraints->'minimum') = 'number')", "true"),
  'm21_required_type': ("and pg_catalog.jsonb_typeof(p_value->'required') = 'boolean'", ""),
  'm22_default_mode_literal': ("(p_value->>'defaultMode') = any (array['none','inherited']::", "(p_value->>'defaultMode') = any (array['none','inherited','literal']::"),
  'm23_default_value_present': ("= '{}'::pg_catalog.jsonb\n       and not (p_value ? 'defaultValue')", "= '{}'::pg_catalog.jsonb"),
  'm24_localization_any': ("array['none','localized','no_fallback']::pg_catalog.text[])\n       and (p_value->>'lifecycle')", "array['none','localized','no_fallback','bogus']::pg_catalog.text[])\n       and (p_value->>'lifecycle')"),
  'm25_lifecycle_any': ("array['active','deprecated','retired']::pg_catalog.text[])\n       and (p_value->>'validatorKey')", "array['active','deprecated','retired','bogus']::pg_catalog.text[])\n       and (p_value->>'validatorKey')"),
  'm26_validator_key': ("and (p_value->>'validatorKey') is null\n       and (p_value->>'validatorVersion') is null", "and (p_value->>'validatorVersion') is null"),
  'm27_validator_version': ("and (p_value->>'validatorKey') is null\n       and (p_value->>'validatorVersion') is null", "and (p_value->>'validatorKey') is null"),
  'm28_extra_top_level_key': ("and (p_value - array['stableFieldId','key','kind','constraints','required','validatorKey','validatorVersion','defaultMode','defaultValue','localizationMode','editorConfig','lifecycle']::pg_catalog.text[]) = '{}'::pg_catalog.jsonb", ""),
  'm29_required_keys_present': ("if p_value ?& array['stableFieldId','key','kind','constraints','required','validatorKey','validatorVersion','defaultMode','localizationMode','editorConfig','lifecycle']::pg_catalog.text[]\n       and", "if true\n       and"),
  'm30_editor_extra_key': ("and (editor_config - array['label','helpText','order']::pg_catalog.text[]) = '{}'::pg_catalog.jsonb", "and true"),
  'm31_editor_required_label': ("then editor_config ?& array['label','order']::pg_catalog.text[]", "then editor_config ?& array['order']::pg_catalog.text[]"),
  'm32_label_length': ("'NFC')) between 1 and 120\n", "'NFC')) between 1 and 121\n"),
  'm33_label_empty': ("'NFC')) between 1 and 120\n", "'NFC')) between 0 and 120\n"),
  'm34_label_raw_length': ("pg_catalog.length(pg_catalog.normalize(editor_config->>'label', 'NFC')) between", "pg_catalog.length(editor_config->>'label') between"),
  'm35_help_text_length': ("pg_catalog.normalize(editor_config->>'helpText', 'NFC')) <= 500", "pg_catalog.normalize(editor_config->>'helpText', 'NFC')) <= 501"),
  'm36_help_text_type': ("or (pg_catalog.jsonb_typeof(editor_config->'helpText') = 'string'\n                and", "or (true\n                and"),
  'm37_order_max': ("'^([0-9]{1,4}|10000)$'", "'^([0-9]{1,5})$'"),
  'm38_order_type': ("and pg_catalog.jsonb_typeof(editor_config->'order') = 'number'\n", "\n"),
  'm39_flag_ignored': ("if p_require_stable_id and pg_catalog.jsonb_typeof(p_value) = 'object' then\n    constraints :=", "if pg_catalog.jsonb_typeof(p_value) = 'object' then\n    constraints :="),
  'm40_label_type': ("and pg_catalog.jsonb_typeof(editor_config->'label') = 'string'\n       and pg_catalog.length", "and pg_catalog.length"),
}

def run(name, old, new):
    t = open(TEST).read()
    t = t.replace('\\ir phase_02_slice_09_valid_field_input_fast_accept/', '\\ir /w/supabase/tests/phase_02_slice_09_valid_field_input_fast_accept/').replace('\\ir support/', '\\ir /w/supabase/tests/support/')
    anchor = '\\ir /w/supabase/tests/phase_02_slice_09_valid_field_input_fast_accept/01-corpus.sqlinc\n'
    assert anchor in t
    mut = ("do $m$ declare d text := pg_get_functiondef('platform_private.cms_valid_field_input(jsonb,boolean)'::regprocedure); o text := $old$%s$old$; n text := $new$%s$new$;\n"
           "begin if (length(d) - length(replace(d, o, ''))) <> length(o) then raise exception 'mutation anchor not unique or absent: %%', %s; end if; execute replace(d, o, n); end $m$;\n") % (old, new, "'" + name + "'")
    t = t.replace(anchor, anchor + mut, 1)
    path = '%s/%s.sql' % (SCRATCH, name)
    open(path, 'w').write(t)
    p = subprocess.run(['bash', RUN, 'run', path], capture_output=True, text=True, env=dict(os.environ))
    out = p.stdout
    m = re.search(r'tap=(\S+)', out)
    tap = m.group(1) if m else None
    text = open(tap).read() if tap and os.path.exists(tap) else out
    if tap:
        dst = '%s/mutant-fast-accept-%s.tap' % (LOGS, name)
        os.replace(tap, dst)
    failed = re.findall(r'^not ok (\d+) - (.*)$', text, re.M)
    anchor_err = 'mutation anchor' in text
    return failed, anchor_err

if __name__ == '__main__':
    names = sys.argv[1:] or list(MUTANTS)
    for n in names:
        failed, anchor_err = run(n, *MUTANTS[n])
        status = 'ANCHOR-ERROR' if anchor_err else ('KILLED' if failed else 'SURVIVED')
        print('%-34s %-12s failing=%d %s' % (n, status, len(failed), '; '.join(t for _, t in failed[:2])[:150]), flush=True)
