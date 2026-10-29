-- Slice 12 lane gaps-db4, P2-S12-AC-256 / DEC-238: each of `provider_key` and `provider_version` is non-null exactly when the provider is `built`.
-- This is a TIGHTENING that implements BE03c line 1624 as amended by DEC-238 and the ratified AC-256, not a repair of a promoted defect.  The
-- promoted CHECK cms_canonical_domain_registry_provider_check (20261013300100) prints the original BE03c DDL formula
--   CHECK ((provider_state = 'built') = (provider_key IS NOT NULL AND provider_version IS NOT NULL))
-- which refuses a built row missing a member and an unbuilt row holding BOTH members, but admits an unbuilt row holding exactly one of them.
-- BE03c 1624 now also carries CHECK((provider_key IS NULL) = (provider_version IS NULL)); the two CHECKs together leave exactly the two legal
-- shapes (built with both members, unbuilt with neither).
-- Populated-table safety (V14-04 / PAT-025, the 20261027100020 convention): a stored half-set row stops the migration with SQLSTATE 55000 and a
-- message naming the count, never a bare 23514, and nothing is changed; the installed shape is asserted before and after.  The six seed rows
-- (role built, five unbuilt with both members null) satisfy the new CHECK.  Forward-only.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $check$
declare
  stored bigint;
  installed text;
begin
  select pg_catalog.count(*) into stored from platform_private.cms_canonical_domain_registry
   where (provider_key is null) is distinct from (provider_version is null);
  if stored > 0 then
    raise exception 'DEC-238 refused: % stored registry row(s) hold exactly one of provider_key and provider_version; the rows are immutable, so repair them in a separately reviewed data-repair migration before this one', stored
      using errcode = '55000';
  end if;
  select pg_catalog.pg_get_constraintdef(con.oid) into installed from pg_catalog.pg_constraint con
   where con.conrelid = 'platform_private.cms_canonical_domain_registry'::pg_catalog.regclass
     and con.conname = 'cms_canonical_domain_registry_provider_check';
  if installed is null or installed !~ 'provider_state = ''built''' or installed !~ 'provider_key IS NOT NULL' or installed !~ 'provider_version IS NOT NULL' then
    raise exception 'DEC-238 unexpected installed provider CHECK: %', installed using errcode = '55000';
  end if;
  if exists (select 1 from pg_catalog.pg_constraint con
              where con.conrelid = 'platform_private.cms_canonical_domain_registry'::pg_catalog.regclass
                and con.conname = 'cms_canonical_domain_registry_provider_pair_check') then
    raise exception 'DEC-238 provider pair CHECK already installed' using errcode = '55000';
  end if;
end;
$check$;

alter table platform_private.cms_canonical_domain_registry
  add constraint cms_canonical_domain_registry_provider_pair_check
  check ((provider_key is null) = (provider_version is null));

do $verify$
declare
  installed text;
begin
  select pg_catalog.pg_get_constraintdef(con.oid) into installed from pg_catalog.pg_constraint con
   where con.conrelid = 'platform_private.cms_canonical_domain_registry'::pg_catalog.regclass
     and con.conname = 'cms_canonical_domain_registry_provider_pair_check' and con.convalidated;
  if installed is null or installed !~ 'provider_key IS NULL' or installed !~ 'provider_version IS NULL' then
    raise exception 'DEC-238 provider pair CHECK not installed: %', installed using errcode = '55000';
  end if;
end;
$verify$;

commit;
