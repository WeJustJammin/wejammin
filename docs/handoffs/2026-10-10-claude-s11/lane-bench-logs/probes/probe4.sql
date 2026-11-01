\ir /w/supabase/tests/support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;
begin;
select no_plan();
do $do$
declare t0 timestamptz; n int; i int; r boolean;
  v text := 'f001'; u text := '11111111-1111-4111-8111-111111111111';
begin
  t0 := clock_timestamp();
  for i in 1..5000 loop r := v ~ '^[a-z][a-z0-9_]{1,63}$'; end loop;
  raise notice 'PROBE %', 'plpgsql key regex x5000: ' || round(extract(epoch from clock_timestamp()-t0)*1000000/5000, 1) || ' us each';
  t0 := clock_timestamp();
  for i in 1..5000 loop r := u ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'; end loop;
  raise notice 'PROBE %', 'plpgsql uuid regex x5000: ' || round(extract(epoch from clock_timestamp()-t0)*1000000/5000, 1) || ' us each';
  t0 := clock_timestamp();
  for i in 1..5000 loop r := v ~ '^a'; end loop;
  raise notice 'PROBE %', 'plpgsql trivial regex x5000: ' || round(extract(epoch from clock_timestamp()-t0)*1000000/5000, 1) || ' us each';
  t0 := clock_timestamp();
  for i in 1..5000 loop r := platform_private.cms_valid_uuid(u); end loop;
  raise notice 'PROBE %', 'cms_valid_uuid x5000: ' || round(extract(epoch from clock_timestamp()-t0)*1000000/5000, 1) || ' us each';
  t0 := clock_timestamp();
  for i in 1..5000 loop r := platform_private.cms_reserved_key(v); end loop;
  raise notice 'PROBE %', 'cms_reserved_key x5000: ' || round(extract(epoch from clock_timestamp()-t0)*1000000/5000, 1) || ' us each';
  t0 := clock_timestamp();
  for i in 1..5000 loop r := platform_private.cms_json_bounded('{}'::jsonb, 8192, 8, 64, 256); end loop;
  raise notice 'PROBE %', 'cms_json_bounded({}) x5000: ' || round(extract(epoch from clock_timestamp()-t0)*1000000/5000, 1) || ' us each';
  t0 := clock_timestamp();
  for i in 1..5000 loop r := platform_private.cms_json_bounded('{"label":"Field 1","order":1}'::jsonb, 8192, 4, 32, 32); end loop;
  raise notice 'PROBE %', 'cms_json_bounded(editorConfig) x5000: ' || round(extract(epoch from clock_timestamp()-t0)*1000000/5000, 1) || ' us each';
  t0 := clock_timestamp();
  for i in 1..5000 loop r := platform_private.cms_exact_keys('{"label":"Field 1","order":1}'::jsonb, array['label','order']::text[], array['label','helpText','order']::text[]); end loop;
  raise notice 'PROBE %', 'cms_exact_keys x5000: ' || round(extract(epoch from clock_timestamp()-t0)*1000000/5000, 1) || ' us each';
  raise notice 'PROBE %', 'collation: ' || (select datcollate from pg_database where datname = current_database()) || ' ctype ' || (select datctype from pg_database where datname = current_database()) || ' encoding ' || pg_encoding_to_char((select encoding from pg_database where datname = current_database()));
end $do$;
select * from finish();
rollback;
