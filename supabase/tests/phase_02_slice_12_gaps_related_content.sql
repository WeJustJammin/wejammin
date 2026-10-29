-- Slice 12 gap lane claude_s12_gaps_db2: P2-S12-AC-228 clause 4 (BE03c 1385 / Canonical records): pin AND exclude rows require a
-- target entry.  related_content/002 asserts the pin half ("a pin row requires a target"); here an EXCLUDE row without
-- target_entry_id is refused by the same table CHECK (23514), the control exclude row with a target inserts, and the derived row
-- (which carries no target) is still accepted so the CHECK is shown to discriminate by mode.
\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_remaining_schema/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_11_schema/000-helpers.sqlinc
\ir phase_02_slice_11_schema/001-fixture.sqlinc
\ir phase_02_slice_11_schema/002-row-builders.sqlinc
\ir phase_02_slice_11_helpers/000-helpers.sqlinc
\ir phase_02_slice_11_helpers/001-world.sqlinc
\ir phase_02_slice_11_helpers/002-reviews.sqlinc
\ir phase_02_slice_11_helpers/004-lineage.sqlinc
\ir phase_02_slice_12_related_content/000-helpers.sqlinc
\ir phase_02_slice_12_related_content/001-world.sqlinc

-- A hand-written rule row in the RPC context, rolled back: 'OK' when the insert is accepted, else the SQLSTATE.
create or replace function pg_temp.g2_rule_row(p_overrides jsonb) returns text language plpgsql as $body$
declare
  base jsonb := jsonb_build_object(
    'id', extensions.gen_random_uuid(), 'created_at', '2026-10-08T12:00:00Z', 'updated_at', '2026-10-08T12:00:00Z',
    'owner_id', pg_temp.h11w_org(), 'state', 'active', 'version', 1,
    'source_entry_id', pg_temp.r12_id('srcZ'), 'target_entry_id', pg_temp.r12_id('c1'), 'mode', 'exclude',
    'reason_code', 'MANUAL_EXCLUSION', 'position', null,
    'created_by', (select value from s10_ids where key = 'creatorAuth'));
  result text;
begin
  perform set_config('app.cms_rpc', 'true', true);
  begin
    insert into platform_private.cms_related_content_rules
      select * from jsonb_populate_record(null::platform_private.cms_related_content_rules, base || p_overrides);
    result := 'OK';
    raise exception 'rollback probe' using errcode = 'P0002';
  exception
    when sqlstate 'P0002' then null;
    when others then result := sqlstate;
  end;
  return result;
end;
$body$;

select is(pg_temp.g2_rule_row('{}'::jsonb), 'OK',
  'control: an exclude row with a target entry and no position inserts [P2-S12-AC-228]');
select is(pg_temp.g2_rule_row('{"target_entry_id":null}'::jsonb), '23514',
  'an exclude row without a target_entry_id is refused by the table CHECK [P2-S12-AC-228]');
select is(pg_temp.g2_rule_row('{"mode":"pin","reason_code":"MANUAL_PIN","position":0,"target_entry_id":null}'::jsonb), '23514',
  'the same CHECK refuses a pin row without a target, so pin and exclude rows both require one [P2-S12-AC-228]');
select is(pg_temp.g2_rule_row('{"mode":"derived","target_entry_id":null,"position":null,"rule_key":"shared-terms","rule_version":1,"reason_code":"SHARED_TERMS","max_candidates":4}'::jsonb), 'OK',
  'control: a derived row carries no target and inserts, so the CHECK discriminates by mode [P2-S12-AC-228]');

select * from finish();
rollback;
