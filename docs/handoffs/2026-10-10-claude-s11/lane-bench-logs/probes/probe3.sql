\ir /w/supabase/tests/support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;
begin;
select no_plan();
create temp table stamps(id int, t timestamptz);
grant all on stamps to public;
create temp table res(label text, ms numeric);
do $do$
declare
  def text; lines text[]; out text := ''; l text; k int := 0; n int;
begin
  def := pg_get_functiondef('platform_private.cms_valid_field_input(jsonb,boolean)'::regprocedure);
  def := replace(replace(def, 'FUNCTION platform_private.cms_valid_field_input(', 'FUNCTION pg_temp.vfi_instr('), ' IMMUTABLE', ' VOLATILE');
  lines := string_to_array(def, E'\n');
  foreach l in array lines loop
    if l ~ '^  (if |kind :=|constraints :=|editor_config :=|return true)' then
      k := k + 1;
      out := out || '  insert into pg_temp.stamps values (' || k || ', clock_timestamp());' || E'\n';
    end if;
    out := out || l || E'\n';
  end loop;
  execute out;
  raise notice 'instrumented % points', k;
end
$do$;
do $do$
declare r jsonb; i int; v jsonb; ok boolean;
begin
  v := jsonb_build_object('stableFieldId', '11111111-1111-4111-8111-111111111111', 'key', 'f001', 'kind', 'short_text',
     'constraints', '{}'::jsonb, 'required', true, 'validatorKey', null, 'validatorVersion', null,
     'defaultMode', 'none', 'localizationMode', 'none',
     'editorConfig', jsonb_build_object('label', 'Field 1', 'order', 1), 'lifecycle', 'active');
  for i in 1..200 loop
    ok := pg_temp.vfi_instr(v, true);
    insert into pg_temp.stamps values (9999, clock_timestamp());
  end loop;
end $do$;
-- per-statement mean duration = next stamp - this stamp
insert into res
select 'stmt ' || lpad(id::text, 2, '0'), round(avg(extract(epoch from (nt - t)) * 1000)::numeric * 1000, 1)
from (select id, t, lead(t) over (order by t) nt from stamps) s where id <> 9999 and nt is not null group by id;
select diag(label || ' = ' || ms || ' us') from res order by label;
select diag('total per call = ' || round((select avg(x) from (select extract(epoch from (max(t) - min(t))) * 1000 x from stamps) q)::numeric / 200 * 1000, 1) || ' us (incl. stamp inserts)');
select * from finish();
rollback;
